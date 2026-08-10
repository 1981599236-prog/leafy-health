const crypto = require("crypto");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  // Use the environment that hosts this cloud function. The Node SDK runs
  // with server-side permissions, so the encrypted AI key stays inaccessible
  // from the web page.
  env: cloudbase.SYMBOL_DEFAULT_ENV,
});
const db = app.database();
const collection = "health_ai_configs";

function currentUid() {
  const { uid } = app.auth().getUserInfo();
  if (!uid) throw new Error("请先登录后再使用 AI 设置");
  return uid;
}

function encryptionKey() {
  const secret = String(process.env.AI_CONFIG_ENCRYPTION_KEY || "");
  if (secret.length < 20) {
    throw new Error("AI 密钥保管尚未初始化，请配置至少 20 位的 AI_CONFIG_ENCRYPTION_KEY");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

function decrypt(value) {
  const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function validateConfig(input) {
  const providerName = String(input.providerName || "").trim();
  const baseUrl = String(input.baseUrl || "").trim().replace(/\/+$/, "");
  const modelName = String(input.modelName || "").trim();
  if (!providerName || !baseUrl || !modelName) throw new Error("请填写服务商名称、API 链接和模型名称");
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") throw new Error("API 链接必须使用 https://");
  return { providerName, baseUrl, modelName };
}

async function getConfig(uid) {
  const result = await db.collection(collection).where({ owner_uid: uid }).limit(1).get();
  return result.data && result.data[0];
}

function publicConfig(config) {
  if (!config) return { configured: false };
  return {
    configured: Boolean(config.encrypted_api_key),
    providerName: config.provider_name,
    baseUrl: config.base_url,
    modelName: config.model_name,
    keyHint: config.key_hint || "",
    updatedAt: config.updated_at,
  };
}

function cleanJson(content) {
  const text = Array.isArray(content) ? content.map((part) => part.text || "").join("") : String(content || "");
  return text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function safeText(value, fallback = "") {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.slice(0, 180) || fallback;
}

function normalizeAnalysis(data, options = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error("AI 没有识别到食物，请换一张更清晰的照片");
  const number = (value) => Math.max(0, Math.round(Number(value) || 0));
  const normalizedItems = items.slice(0, 12).map((item) => ({
    name: safeText(item.name, "未命名食物"),
    portion: safeText(item.portion || item.quantity, "估算一份"),
    grams: number(item.grams || item.estimated_grams),
    calories: number(item.calories),
  }));
  const itemCalories = normalizedItems.reduce((total, item) => total + item.calories, 0);
  const declaredTotal = number(data.totalCalories || data.total_calories);
  const totalCalories = itemCalories || declaredTotal;
  if (!totalCalories) throw new Error("AI 没有给出可用热量，请换一张更清晰的照片");

  const proteinG = number(data.proteinG || data.protein_g);
  const carbsG = number(data.carbsG || data.carbs_g);
  const fatG = number(data.fatG || data.fat_g);
  const auditFlags = [];
  const allowedDifference = Math.max(40, Math.round(totalCalories * 0.15));
  if (declaredTotal && Math.abs(declaredTotal - itemCalories) > allowedDifference) {
    auditFlags.push("总热量与食物明细不一致");
  }
  const macroCalories = proteinG * 4 + carbsG * 4 + fatG * 9;
  if (
    macroCalories &&
    Math.abs(macroCalories - totalCalories) > Math.max(150, Math.round(totalCalories * 0.45))
  ) {
    auditFlags.push("三大营养素与热量估算差异较大");
  }

  const confidence = ["high", "medium", "low"].includes(data.confidence)
    ? data.confidence
    : auditFlags.length
      ? "medium"
      : "high";
  const needsUserInput = Boolean(data.needsUserInput || data.needs_user_input);
  return {
    analysis: {
      items: normalizedItems,
      // 用各食物热量之和作为最终总热量，避免展示两套相互矛盾的数字。
      totalCalories,
      proteinG,
      carbsG,
      fatG,
      sugarG: number(data.sugarG || data.sugar_g),
      fiberG: number(data.fiberG || data.fiber_g || data.dietary_fiber_g),
      confidence,
      confidenceReason: safeText(
        data.confidenceReason || data.confidence_reason,
        confidence === "high" ? "食物与份量在照片中较清楚" : "照片中的份量或做法存在估算空间",
      ),
      estimateBasis: safeText(
        data.estimateBasis || data.estimate_basis,
        "按照片可见食物与常见熟食的平均营养数据估算",
      ),
      needsUserInput,
      followUpQuestion: safeText(data.followUpQuestion || data.follow_up_question),
      reviewed: Boolean(options.reviewed),
      reviewNotes: Array.isArray(options.reviewNotes) ? options.reviewNotes.slice(0, 3) : [],
    },
    auditFlags,
  };
}

async function callVisionModel(config, imageUrl, instruction, userPrompt) {
  const apiKey = decrypt(config.encrypted_api_key);
  const endpoint = config.base_url.endsWith("/chat/completions")
    ? config.base_url
    : `${config.base_url}/chat/completions`;
  const isTencentTokenHub = new URL(config.base_url).hostname === "tokenhub.tencentmaas.com";
  const messages = isTencentTokenHub
    ? [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: `${instruction}\n${userPrompt}` },
          ],
        },
      ]
    : [
        { role: "system", content: instruction },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ];
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: config.model_name, messages, temperature: 0 }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.message || `AI 请求失败（${response.status}）`);
  return JSON.parse(cleanJson(body.choices?.[0]?.message?.content));
}

async function recognize(config, imageDataUrl, userNote) {
  const imageUrl = String(imageDataUrl || "");
  const isDataImage = imageUrl.startsWith("data:image/");
  const isHttpsImage = imageUrl.startsWith("https://");
  if (!isDataImage && !isHttpsImage) throw new Error("请上传一张图片");
  if (isDataImage && imageUrl.length > 4_000_000) throw new Error("图片过大，请重新拍摄或选择较小的照片");
  const note = safeText(userNote).slice(0, 240);
  const instruction = [
    "你是保守、可复现的日常食物记录助手。只返回 JSON，不要 Markdown。",
    "必须使用格式：{items:[{name,portion,grams,calories}],totalCalories,proteinG,carbsG,fatG,sugarG,fiberG,confidence,confidenceReason,estimateBasis,needsUserInput,followUpQuestion}。",
    "只列出照片中清楚可见的食物；不要猜测被遮住的食材、油、糖、酱汁或菜名中没有看见的配料。",
    "无法可靠识别的内容可以不列出，绝对不要编造食物名称。",
    "份量只能根据可见的盘、碗和食物体积估算；没有尺度时使用普通成年人一餐的标准中等份量。",
    "热量必须采用常见熟食的固定平均值估算，同一种食物和相近份量应给出相近结果。",
    "不要因为不确定而随意增加油、调料或隐藏配料的热量；只能在照片中明显可见时计算。",
    "所有 grams、calories、totalCalories、proteinG、carbsG、fatG、sugarG、fiberG 都必须是非负整数；calories 和 totalCalories 必须四舍五入到最接近的 10 kcal。",
    "totalCalories 必须等于所有 items.calories 之和。营养素同样只作保守估计。",
    "confidence 只能是 high、medium、low。只有食物、做法和份量都较清楚时用 high。estimateBasis 说明估算依据，followUpQuestion 只在用户补充一句话能明显改善结果时填写，否则为空字符串。",
    "用户补充说明只可作为已知事实使用；若与照片冲突，以照片可见内容为准，不能据此编造隐藏食材。",
  ].join("\\n");
  const userPrompt = [
    "请按以上固定、保守规则识别这张餐食照片，并给出日常记录用的估算。",
    note ? `用户补充说明：${note}` : "用户没有补充说明。",
  ].join("\\n");
  const initial = normalizeAnalysis(await callVisionModel(config, imageUrl, instruction, userPrompt));
  const mustReview = initial.analysis.confidence !== "high" || initial.auditFlags.length > 0 || initial.analysis.needsUserInput;
  if (!mustReview) {
    return { ...initial.analysis, reviewNotes: ["已完成食物明细与热量的一致性校验"] };
  }

  const reviewerInstruction = [
    "你是餐食热量结果的独立复核员。只返回 JSON，不要 Markdown。",
    "请再次查看同一张照片与用户说明，检查候选结果的食物名称、可见份量、热量总和与营养素是否自洽。",
    "只能修正照片或数学上能够确认的问题。看不清时必须保守，不得添加隐藏油、酱汁、配料或食物。",
    "保持格式：{items:[{name,portion,grams,calories}],totalCalories,proteinG,carbsG,fatG,sugarG,fiberG,confidence,confidenceReason,estimateBasis,needsUserInput,followUpQuestion}。",
    "totalCalories 必须等于 items.calories 之和，所有数值为非负整数，热量取最接近的 10 kcal。",
  ].join("\\n");
  const reviewerPrompt = [
    "请复核候选结果。若无明确错误，保持候选结果，不要为了变化而改数字。",
    `候选结果：${JSON.stringify(initial.analysis)}`,
    note ? `用户补充说明：${note}` : "用户没有补充说明。",
    initial.auditFlags.length ? `程序发现：${initial.auditFlags.join("；")}` : "程序未发现明显数学冲突，但图片仍有不确定性。",
  ].join("\\n");
  try {
    const reviewed = normalizeAnalysis(
      await callVisionModel(config, imageUrl, reviewerInstruction, reviewerPrompt),
      { reviewed: true, reviewNotes: ["AI 已根据照片与数值一致性再次复核"] },
    );
    return reviewed.analysis;
  } catch (error) {
    // 第一次结果仍然可用，不能因为复核请求偶发失败而让用户完全失去记录结果。
    return {
      ...initial.analysis,
      reviewNotes: ["已完成基础一致性校验，二次复核暂时不可用"],
    };
  }
}

exports.main = async (event) => {
  const uid = currentUid();
  if (event.action === "getConfig") return publicConfig(await getConfig(uid));
  if (event.action === "saveConfig") {
    const config = validateConfig(event);
    const existing = await getConfig(uid);
    const apiKey = String(event.apiKey || "").trim();
    if (!apiKey && !existing?.encrypted_api_key) throw new Error("请首次填写 API Key");
    const row = {
      owner_uid: uid,
      provider_name: config.providerName,
      base_url: config.baseUrl,
      model_name: config.modelName,
      encrypted_api_key: apiKey ? encrypt(apiKey) : existing.encrypted_api_key,
      key_hint: apiKey ? apiKey.slice(-4) : existing.key_hint,
      updated_at: new Date().toISOString(),
    };
    if (existing?._id) await db.collection(collection).doc(existing._id).update(row);
    else await db.collection(collection).add(row);
    return publicConfig(row);
  }
  if (event.action === "recognize") {
    const config = await getConfig(uid);
    if (!config?.encrypted_api_key) throw new Error("请先在“我的”页面保存 AI 配置");
    return recognize(config, event.imageDataUrl, event.userNote);
  }
  throw new Error("未知的 AI 操作");
};
