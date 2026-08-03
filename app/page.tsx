"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { cloudApp, cloudAuth, cloudDb } from "../lib/cloudbase";

type View = "home" | "blood" | "food" | "exercise" | "trend" | "settings";
type Profile = {
  display_name: string;
  gender: "男" | "女";
  age: string;
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  goal: string;
};
type Exercise = {
  activity_type: string;
  duration_minutes: number;
  calories: number;
};
type Blood = { systolic: string; diastolic: string; heart_rate: string };
type BloodRecord = {
  _id?: string;
  systolic: number;
  diastolic: number;
  heart_rate?: number;
  createdAt: string;
};
type TrendDay = { key: string; label: string };
type MetricPoint = TrendDay & { value: number; hasValue: boolean };
type AiConfig = {
  configured: boolean;
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
  keyHint: string;
};
type FoodAnalysis = {
  items: { name: string; portion: string; grams: number; calories: number }[];
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};
type CloudUser = { id: string; username?: string };
const emptyProfile: Profile = {
  display_name: "叶",
  gender: "女",
  age: "",
  height_cm: "",
  weight_kg: "",
  activity_level: "久坐",
  goal: "保持",
};
const emptyAiConfig: AiConfig = {
  configured: false,
  providerName: "",
  baseUrl: "",
  modelName: "",
  apiKey: "",
  keyHint: "",
};
const exercises = [
  { activity_type: "散步", emoji: "🚶", duration_minutes: 30, calories: 110 },
  { activity_type: "跑步", emoji: "🏃", duration_minutes: 30, calories: 280 },
  {
    activity_type: "力量训练",
    emoji: "🏋️",
    duration_minutes: 40,
    calories: 250,
  },
  { activity_type: "骑车", emoji: "🚲", duration_minutes: 30, calories: 180 },
];
const formatDate = (value: string) => new Date(value).getDate();
const dayKey = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const trendDaysFor = (count: number): TrendDay[] => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - index - 1));
    return { key: dayKey(date), label: `${date.getMonth() + 1}/${date.getDate()}` };
  });
};
const caloriesByDay = (rows: any[]) =>
  rows.reduce((map, row) => {
    const key = dayKey(row.createdAt);
    map.set(key, (map.get(key) ?? 0) + Number(row.calories ?? 0));
    return map;
  }, new Map<string, number>());
function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const item = error as Record<string, unknown>;
    const message =
      item.message ?? item.error_description ?? item.msg ?? item.code;
    if (typeof message === "string") return message;
  }
  return "网络请求未完成，请稍后重试";
}
function currentUser(result: any): CloudUser | null {
  const user =
    result?.data?.session?.user ??
    result?.data?.user ??
    result?.session?.user ??
    result?.user;
  const id = user?.id ?? user?.uid ?? user?.sub;
  return id ? { id, username: user.username } : null;
}

async function photoForAi(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("请选择一张图片");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("这张图片暂时无法读取，请换一张 JPG 或 PNG 图片"));
      element.src = source;
    });
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片处理暂时不可用，请稍后再试");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(source);
  }
}
// 保留页面末尾的退出按钮写法；实际退出的是 CloudBase 会话。
const supabase = {
  auth: {
    signOut: async () => {
      await cloudAuth.signOut();
      window.location.reload();
    },
  },
};

function Plant({ growth }: { growth: number }) {
  return (
    <section className="plant">
      <div className="sun" />
      <div className="leaf l1" />
      <div className="leaf l2" />
      {growth >= 30 && (
        <>
          <div className="leaf l3" />
          <div className="leaf l4" />
        </>
      )}
      {growth >= 60 && <div className="flower">✿</div>}
      <div className="stem" />
      <div className="pot" />
      <div className="plant-label">
        <b>
          {growth >= 90
            ? "今天开花啦"
            : growth >= 60
              ? "正在长新叶"
              : growth >= 30
                ? "悄悄发芽中"
                : "从一条记录开始"}
        </b>
        <span>今日成长值 {growth}/90</span>
      </div>
    </section>
  );
}
function Nav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav>
      <button
        className={view === "home" ? "active" : ""}
        onClick={() => setView("home")}
      >
        ⌂<span>今日</span>
      </button>
      <button
        className={view === "trend" ? "active" : ""}
        onClick={() => setView("trend")}
      >
        ⌁<span>趋势</span>
      </button>
      <button
        className={view === "settings" ? "active" : ""}
        onClick={() => setView("settings")}
      >
        ☼<span>我的</span>
      </button>
    </nav>
  );
}
function Back({
  title,
  subtitle,
  go,
}: {
  title: string;
  subtitle: string;
  go: () => void;
}) {
  return (
    <header className="back">
      <button onClick={go}>‹</button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

export default function Page() {
  const [user, setUser] = useState<CloudUser | null>(null),
    [ready, setReady] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [verificationCode, setVerificationCode] = useState(""),
    [verification, setVerification] = useState<any>(null),
    [creatingAccount, setCreatingAccount] = useState(false),
    [loggingIn, setLoggingIn] = useState(false),
    [profileId, setProfileId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null),
    [draft, setDraft] = useState<Profile>(emptyProfile),
    [view, setView] = useState<View>("home"),
    [dataReady, setDataReady] = useState(false);
  const [blood, setBlood] = useState<Blood>({
      systolic: "",
      diastolic: "",
      heart_rate: "",
    }),
    [bloodDone, setBloodDone] = useState(false);
  const [bloodHistory, setBloodHistory] = useState<BloodRecord[]>([]),
    [foodHistory, setFoodHistory] = useState<any[]>([]),
    [exerciseHistory, setExerciseHistory] = useState<any[]>([]),
    [trendRange, setTrendRange] = useState<7 | 30>(7),
    [selectedTrendDay, setSelectedTrendDay] = useState<string | null>(null);
  const [intake, setIntake] = useState(0),
    [exerciseTotal, setExerciseTotal] = useState(0),
    [latestExercise, setLatestExercise] = useState<Exercise | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set()),
    [foodStage, setFoodStage] = useState<"upload" | "result">("upload"),
    [toast, setToast] = useState(""),
    [foodAnalysis, setFoodAnalysis] = useState<FoodAnalysis | null>(null),
    [isRecognizing, setIsRecognizing] = useState(false),
    [aiConfig, setAiConfig] = useState<AiConfig>(emptyAiConfig),
    [aiConfigLoading, setAiConfigLoading] = useState(false),
    [aiConfigSaving, setAiConfigSaving] = useState(false);
  const savedBlood = useRef("");
  const now = new Date();
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const bmr = useMemo(() => {
    const age = Number(profile?.age || 28),
      h = Number(profile?.height_cm || 165),
      w = Number(profile?.weight_kg || 58);
    const basic =
      10 * w + 6.25 * h - 5 * age + (profile?.gender === "男" ? 5 : -161);
    return Math.round(
      basic *
        (profile?.activity_level === "经常运动"
          ? 1.55
          : profile?.activity_level === "轻度活动"
            ? 1.35
            : 1.2),
    );
  }, [profile]);
  const growth =
    (bloodDone ? 30 : 0) + (intake > 0 ? 30 : 0) + (exerciseTotal > 0 ? 30 : 0);
  const totalOut = bmr + exerciseTotal;
  const balance = intake - totalOut;
  const days = Array.from(
    { length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1,
  );
  const blanks = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const trendDays = useMemo(() => trendDaysFor(trendRange), [trendRange]);
  const bloodTrendDays = useMemo(() => {
    const latestByDay = new Map<string, BloodRecord>();
    bloodHistory.forEach((record) => {
      const key = dayKey(record.createdAt);
      if (!latestByDay.has(key)) latestByDay.set(key, record);
    });
    return trendDays.map((day) => ({ ...day, record: latestByDay.get(day.key) }));
  }, [bloodHistory, trendDays]);
  const foodTrend = useMemo<MetricPoint[]>(() => {
    const totals = caloriesByDay(foodHistory);
    return trendDays.map((day) => ({
      ...day,
      value: totals.get(day.key) ?? 0,
      hasValue: totals.has(day.key),
    }));
  }, [foodHistory, trendDays]);
  const exerciseTrend = useMemo<MetricPoint[]>(() => {
    const totals = caloriesByDay(exerciseHistory);
    return trendDays.map((day) => ({
      ...day,
      value: totals.get(day.key) ?? 0,
      hasValue: totals.has(day.key),
    }));
  }, [exerciseHistory, trendDays]);
  const balanceTrend = useMemo<MetricPoint[]>(() => {
    return trendDays.map((day, index) => {
      const hasValue = foodTrend[index].hasValue || exerciseTrend[index].hasValue;
      return {
        ...day,
        value: foodTrend[index].value - (bmr + exerciseTrend[index].value),
        hasValue,
      };
    });
  }, [bmr, exerciseTrend, foodTrend, trendDays]);
  const selectedBlood = bloodTrendDays.find(
    (day) => day.key === selectedTrendDay,
  );

  useEffect(() => {
    let active = true;
    cloudAuth
      .getSession()
      .then((result: any) => {
        if (active) setUser(currentUser(result));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (user) {
      setDataReady(false);
      void loadData().finally(() => setDataReady(true));
    } else {
      setDataReady(false);
      setProfile(null);
      setBlood({ systolic: "", diastolic: "", heart_rate: "" });
      setIntake(0);
      setExerciseTotal(0);
      setChecked(new Set());
      setBloodHistory([]);
      setFoodHistory([]);
      setExerciseHistory([]);
      setSelectedTrendDay(null);
    }
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (user && view === "settings") void loadAiConfig();
  }, [user, view]);

  async function loadData() {
    if (!user) return;
    try {
      // 集合已设为“读取和修改本人数据”，CloudBase 会在服务端按当前登录用户
      // 自动筛选记录；不额外按 _openid 查询，以兼容邮箱账号的 uid 身份。
      const own = (collection: string) =>
        cloudDb.collection(collection).limit(100).get();
      const [profileRes, bpRes, foodRes, exerciseRes] = await Promise.all([
        own("health_profiles"),
        own("health_blood"),
        own("health_food"),
        own("health_exercise"),
      ]);
      const p = [...(profileRes.data ?? [])].sort((a: any, b: any) =>
        String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
      )[0];
      if (p) {
        setProfileId(p._id);
        setProfile({
          display_name: p.display_name,
          gender: p.gender,
          age: String(p.age),
          height_cm: String(p.height_cm),
          weight_kg: String(p.weight_kg),
          activity_level: p.activity_level,
          goal: p.goal,
        });
      }
      const bpRows = (bpRes.data ?? []) as any[];
      const foodRows = (foodRes.data ?? []) as any[];
      const exerciseRows = (exerciseRes.data ?? []) as any[];
      setBloodHistory(
        bpRows
          .filter((row) => row.createdAt)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      );
      setFoodHistory(foodRows.filter((row) => row.createdAt));
      setExerciseHistory(exerciseRows.filter((row) => row.createdAt));
      const todayBp = bpRows.find((item) => item.createdAt >= dayStart);
      if (todayBp) {
        const key = `${todayBp.systolic}/${todayBp.diastolic}/${todayBp.heart_rate ?? ""}`;
        savedBlood.current = key;
        setBlood({
          systolic: String(todayBp.systolic),
          diastolic: String(todayBp.diastolic),
          heart_rate:
            todayBp.heart_rate == null ? "" : String(todayBp.heart_rate),
        });
        setBloodDone(true);
      } else {
        setBloodDone(false);
      }
      const todayFood = foodRows.filter((item) => item.createdAt >= dayStart);
      setIntake(todayFood.reduce((sum, item) => sum + item.calories, 0));
      const dayExercise = exerciseRows.filter(
        (item) => item.createdAt >= dayStart,
      );
      setExerciseTotal(
        dayExercise.reduce((sum, item) => sum + item.calories, 0),
      );
      if (dayExercise[0]) setLatestExercise(dayExercise[0]);
      const checkedDays = new Set<number>();
      [...bpRows, ...foodRows, ...exerciseRows].forEach((item) =>
        checkedDays.add(formatDate(item.createdAt)),
      );
      setChecked(checkedDays);
    } catch (error) {
      setToast(`暂时无法读取记录：${errorMessage(error)}`);
    }
  }
  async function signIn() {
    if (!username.trim() || password.length < 8)
      return setToast("请输入用户名和至少 8 位密码");
    setLoggingIn(true);
    try {
      const result = await cloudAuth.signInWithPassword({
        username: username.trim(),
        password,
      });
      if (result?.error) throw result.error;
      const nextUser =
        currentUser(result) ?? currentUser(await cloudAuth.getSession());
      if (!nextUser) throw new Error("登录未完成，请稍后重试");
      setUser(nextUser);
      setPassword("");
    } catch (error) {
      setToast(`登录失败：${errorMessage(error)}`);
    } finally {
      setLoggingIn(false);
    }
  }
  async function sendVerification() {
    if (!email.trim()) return setToast("请先输入你的邮箱");
    setLoggingIn(true);
    try {
      const result = await cloudAuth.getVerification({ email: email.trim() });
      if (result?.error) throw result.error;
      const data = result?.data ?? result;
      if (!data?.verification_id) throw new Error("验证码暂时无法发送");
      setVerification(data);
      setToast("验证码已发送，请查看邮箱");
    } catch (error) {
      setToast(`发送失败：${errorMessage(error)}`);
    } finally {
      setLoggingIn(false);
    }
  }
  async function createAccount() {
    if (
      !verification ||
      !verificationCode ||
      !username.trim() ||
      password.length < 8
    )
      return setToast("请补全邮箱验证码、用户名和至少 8 位密码");
    setLoggingIn(true);
    try {
      const verified = await cloudAuth.verify({
        verification_id: verification.verification_id,
        verification_code: verificationCode,
      });
      if (verified?.error) throw verified.error;
      const verificationToken = (verified?.data ?? verified)
        ?.verification_token;
      if (!verificationToken) throw new Error("验证码校验未完成");
      const result = await cloudAuth.signUp({
        email: email.trim(),
        verification_code: verificationCode,
        verification_token: verificationToken,
        username: username.trim(),
        password,
      });
      if (result?.error) throw result.error;
      const nextUser =
        currentUser(result) ?? currentUser(await cloudAuth.getSession());
      if (!nextUser) throw new Error("账号已创建，请切换到登录后进入");
      setUser(nextUser);
      setPassword("");
    } catch (error) {
      setToast(`创建账号失败：${errorMessage(error)}`);
    } finally {
      setLoggingIn(false);
    }
  }
  async function saveProfile() {
    if (!user || !draft.age || !draft.height_cm || !draft.weight_kg)
      return setToast("请补全年龄、身高和体重");
    const row = {
      display_name: draft.display_name.trim() || "叶",
      gender: draft.gender,
      age: Number(draft.age),
      height_cm: Number(draft.height_cm),
      weight_kg: Number(draft.weight_kg),
      activity_level: draft.activity_level,
      goal: draft.goal,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (profileId)
        await cloudDb.collection("health_profiles").doc(profileId).update(row);
      else {
        const result = await cloudDb.collection("health_profiles").add(row);
        setProfileId(result._id ?? result.id ?? result.ids?.[0] ?? "");
      }
      setProfile({ ...draft, display_name: row.display_name });
      setToast("档案已保存");
    } catch (error) {
      setToast(`保存失败：${errorMessage(error)}`);
    }
  }
  async function saveBlood() {
    if (!user || !blood.systolic || !blood.diastolic || !blood.heart_rate)
      return;
    const key = `${blood.systolic}/${blood.diastolic}/${blood.heart_rate}`;
    if (savedBlood.current === key) return;
    savedBlood.current = key;
    try {
      await cloudDb
        .collection("health_blood")
        .add({
          systolic: Number(blood.systolic),
          diastolic: Number(blood.diastolic),
          heart_rate: Number(blood.heart_rate),
          createdAt: new Date().toISOString(),
        });
      setBloodDone(true);
      setChecked((current) => new Set(current).add(now.getDate()));
      setToast("血压和心率已记录，小叶子长高一点");
    } catch (error) {
      savedBlood.current = "";
      setToast(`保存失败：${errorMessage(error)}`);
    }
  }

  async function callFoodAi(data: Record<string, unknown>) {
    const result = await (cloudApp as any).callFunction({
      name: "food_ai",
      data,
      parse: true,
    });
    const body = result?.result ?? result?.data ?? result;
    if (body?.error) throw body.error;
    return body;
  }

  async function loadAiConfig() {
    if (!user) return;
    setAiConfigLoading(true);
    try {
      const result = await callFoodAi({ action: "getConfig" });
      setAiConfig({
        ...emptyAiConfig,
        ...result,
        apiKey: "",
      });
    } catch (error) {
      setToast(`AI 设置暂时无法读取：${errorMessage(error)}`);
    } finally {
      setAiConfigLoading(false);
    }
  }

  async function saveAiConfig() {
    if (!aiConfig.providerName || !aiConfig.baseUrl || !aiConfig.modelName)
      return setToast("请填完服务商名称、API 链接和模型名称");
    setAiConfigSaving(true);
    try {
      const result = await callFoodAi({
        action: "saveConfig",
        providerName: aiConfig.providerName,
        baseUrl: aiConfig.baseUrl,
        modelName: aiConfig.modelName,
        apiKey: aiConfig.apiKey,
      });
      setAiConfig({ ...emptyAiConfig, ...result, apiKey: "" });
      setToast("AI 配置已安全保存，可以去拍照试试看了");
    } catch (error) {
      setToast(`AI 配置保存失败：${errorMessage(error)}`);
    } finally {
      setAiConfigSaving(false);
    }
  }

  async function saveFood() {
    if (!user || !foodAnalysis) return;
    try {
      await cloudDb.collection("health_food").add({
        items: foodAnalysis.items.map((item) => ({
          name: item.name,
          quantity: item.portion,
          grams: item.grams,
          calories: item.calories,
        })),
        calories: foodAnalysis.totalCalories,
        protein_g: foodAnalysis.proteinG,
        carbs_g: foodAnalysis.carbsG,
        fat_g: foodAnalysis.fatG,
        createdAt: new Date().toISOString(),
      });
      setIntake((x) => x + foodAnalysis.totalCalories);
      setChecked((current) => new Set(current).add(now.getDate()));
      setFoodStage("upload");
      setFoodAnalysis(null);
      setView("home");
      setToast("饮食已记录，成长值 +30");
    } catch (error) {
      setToast(`保存失败：${errorMessage(error)}`);
    }
  }
  async function saveExercise(item: (typeof exercises)[number]) {
    if (!user) return;
    try {
      await cloudDb
        .collection("health_exercise")
        .add({
          activity_type: item.activity_type,
          duration_minutes: item.duration_minutes,
          calories: item.calories,
          createdAt: new Date().toISOString(),
        });
      setLatestExercise(item);
      setExerciseTotal((x) => x + item.calories);
      setChecked((current) => new Set(current).add(now.getDate()));
      setToast(`${item.activity_type} 已记录，成长值 +30`);
    } catch (error) {
      setToast(`保存失败：${errorMessage(error)}`);
    }
  }
  async function foodFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!aiConfig.configured)
      return setToast("请先到“我的”页面填好 AI 模型设置");
    setIsRecognizing(true);
    setToast("AI 正在识别这餐，请稍等…");
    try {
      const imageDataUrl = await photoForAi(file);
      const result = await callFoodAi({ action: "recognize", imageDataUrl });
      setFoodAnalysis(result as FoodAnalysis);
      setFoodStage("result");
      setToast("识别完成，确认后再记录");
    } catch (error) {
      setToast(`识别失败：${errorMessage(error)}`);
    } finally {
      setIsRecognizing(false);
    }
  }
  if (!ready)
    return <main className="shell loading">正在准备你的健康记录…</main>;
  if (!user)
    return (
      <main className="shell login">
        <div className="seed">🌱</div>
        <p>{creatingAccount ? "先确认是你本人" : "欢迎来到 一叶"}</p>
        <h1>
          每天，照顾
          <br />
          一下自己。
        </h1>
        {creatingAccount && (
          <>
            <label>
              邮箱地址
              <input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {verification && (
              <label>
                邮箱验证码
                <input
                  inputMode="numeric"
                  placeholder="请输入邮件中的验证码"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </label>
            )}
            <button
              className="primary"
              disabled={loggingIn || !email.trim()}
              onClick={sendVerification}
            >
              {loggingIn
                ? "请稍等…"
                : verification
                  ? "重新发送验证码"
                  : "发送邮箱验证码"}
            </button>
          </>
        )}
        <label>
          用户名
          <input
            autoComplete="username"
            placeholder="例如 leafy2026"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete={creatingAccount ? "new-password" : "current-password"}
            placeholder="至少 8 位，建议含字母、数字和符号"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={
            loggingIn ||
            !username.trim() ||
            password.length < 8 ||
            (creatingAccount && (!verification || !verificationCode))
          }
          onClick={creatingAccount ? createAccount : signIn}
        >
          {loggingIn
            ? "请稍等…"
            : creatingAccount
              ? "确认并创建账号 →"
              : "进入我的记录 →"}
        </button>
        <button
          className="auth-switch"
          onClick={() => {
            setCreatingAccount((value) => !value);
            setPassword("");
            setVerification(null);
            setVerificationCode("");
          }}
        >
          {creatingAccount ? "已有账号？直接登录" : "第一次使用？创建账号"}
        </button>
        <small>
          {creatingAccount
            ? "邮箱验证码只在第一次创建账号时使用。"
            : "你的记录只属于当前账号。"}
        </small>
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  if (!dataReady)
    return <main className="shell loading">正在同步你的健康记录…</main>;
  if (!profile)
    return (
      <main className="shell onboarding">
        <div className="seed">🌱</div>
        <p>先认识一下你的身体</p>
        <h1>只需一分钟</h1>
        <span className="intro">
          这些信息只用于估算每日消耗，不作医疗判断。
        </span>
        <label>
          显示文字
          <input
            maxLength={2}
            value={draft.display_name}
            onChange={(e) =>
              setDraft({ ...draft, display_name: e.target.value })
            }
          />
        </label>
        <div className="two">
          <label>
            年龄
            <input
              inputMode="numeric"
              value={draft.age}
              onChange={(e) => setDraft({ ...draft, age: e.target.value })}
              placeholder="28"
            />
          </label>
          <label>
            身高
            <input
              inputMode="numeric"
              value={draft.height_cm}
              onChange={(e) =>
                setDraft({ ...draft, height_cm: e.target.value })
              }
              placeholder="165 cm"
            />
          </label>
        </div>
        <label>
          体重
          <input
            inputMode="decimal"
            value={draft.weight_kg}
            onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value })}
            placeholder="58 kg"
          />
        </label>
        <Choices
          value={draft.gender}
          values={["女", "男"]}
          change={(gender) =>
            setDraft({ ...draft, gender: gender as "男" | "女" })
          }
        />
        <Choices
          value={draft.activity_level}
          values={["久坐", "轻度活动", "经常运动"]}
          change={(activity_level) => setDraft({ ...draft, activity_level })}
        />
        <Choices
          value={draft.goal}
          values={["减脂", "保持", "增肌"]}
          change={(goal) => setDraft({ ...draft, goal })}
        />
        <button className="primary" onClick={saveProfile}>
          开始记录 →
        </button>
        {toast && <div className="toast">{toast}</div>}
      </main>
    );
  const name = profile.display_name || "叶";
  return (
    <main className="shell app">
      {view === "home" && (
        <section className="page">
          <header className="homehead">
            <div>
              <p>
                {new Intl.DateTimeFormat("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                }).format(now)}
              </p>
              <h1>早上好 🌱</h1>
              <span>今天也照顾一下自己。</span>
            </div>
            <button className="avatar" onClick={() => setView("settings")}>
              {name}
            </button>
          </header>
          <Plant growth={growth} />
          <h2 className="sectiontitle">
            今天，做这三件小事 <i>{growth}/90</i>
          </h2>
          <Action
            emoji="🩺"
            title={bloodDone ? "血压已记录" : "记录血压"}
            detail={
              bloodDone
                ? `${blood.systolic} / ${blood.diastolic}${blood.heart_rate ? ` · ${blood.heart_rate} bpm` : ""}`
                : "花 10 秒，了解此刻的自己"
            }
            done={bloodDone}
            click={() => setView("blood")}
          />
          <Action
            emoji="🍱"
            title={intake ? "饮食已记录" : "记录饮食"}
            detail={
              intake ? `今日已摄入 ${intake} kcal` : "拍张照，剩下交给 AI"
            }
            done={intake > 0}
            click={() => setView("food")}
          />
          <Action
            emoji="🏃"
            title={exerciseTotal ? "运动已记录" : "记录运动"}
            detail={
              latestExercise
                ? `${latestExercise.activity_type} · 今日 ${exerciseTotal} kcal`
                : "动一动，也给自己一个赞"
            }
            done={exerciseTotal > 0}
            click={() => setView("exercise")}
          />
          <section className="energy">
            <h2>
              今日能量{" "}
              <i>
                {intake
                  ? balance < 0
                    ? "🔥 消耗中"
                    : "⚖️ 接近平衡"
                  : "等待记录"}
              </i>
            </h2>
            <div>
              <Stat label="摄入" value={intake || "—"} />
              <Stat label="消耗" value={totalOut} />
              <Stat label="热量差" value={intake ? balance : "—"} />
            </div>
          </section>
          <Calendar
            checked={checked}
            days={days}
            blanks={blanks}
            month={now.getMonth() + 1}
            today={now.getDate()}
          />
        </section>
      )}
      {view === "blood" && (
        <section className="page">
          <Back
            title="记录血压"
            subtitle="输入后自动保存"
            go={() => setView("home")}
          />
          <div className="card bp">
            <label>
              收缩压
              <input
                autoFocus
                inputMode="numeric"
                placeholder="120"
                value={blood.systolic}
                onChange={(e) =>
                  setBlood({ ...blood, systolic: e.target.value })
                }
                onBlur={saveBlood}
              />
              <small>mmHg</small>
            </label>
            <b>/</b>
            <label>
              舒张压
              <input
                inputMode="numeric"
                placeholder="80"
                value={blood.diastolic}
                onChange={(e) =>
                  setBlood({ ...blood, diastolic: e.target.value })
                }
                onBlur={saveBlood}
              />
              <small>mmHg</small>
            </label>
            <label>
              心率
              <input
                inputMode="numeric"
                placeholder="72"
                value={blood.heart_rate}
                onChange={(e) =>
                  setBlood({ ...blood, heart_rate: e.target.value })
                }
                onBlur={saveBlood}
              />
              <small>bpm</small>
            </label>
          </div>
          {bloodDone && (
            <div className="reference">
              <b>
                你的血压　{blood.systolic} / {blood.diastolic}
              </b>
              <span>心率：{blood.heart_rate ? `${blood.heart_rate} bpm` : "未记录"}</span>
              <span>
                参考值 120 / 80　收缩压{" "}
                {Number(blood.systolic) >= 120 ? "↑" : "↓"}
                {Math.abs(Number(blood.systolic) - 120)}　舒张压{" "}
                {Number(blood.diastolic) >= 80 ? "↑" : "↓"}
                {Math.abs(Number(blood.diastolic) - 80)}
              </span>
            </div>
          )}
          <p className="helper">不做判断，只为你留下一份温和的日常参考。</p>
        </section>
      )}
      {view === "food" && (
        <section className="page">
          <Back
            title="记录饮食"
            subtitle="拍张照，AI 帮你整理"
            go={() => setView("home")}
          />
          {foodStage === "upload" ? (
            <label className="upload">
              ⌁<b>拍照或上传餐食照片</b>
              <span>
                {isRecognizing
                  ? "正在识别，请稍等…"
                  : aiConfig.configured
                    ? `当前模型：${aiConfig.modelName}`
                    : "先到“我的”里填写 AI 模型设置"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={isRecognizing}
                onChange={foodFile}
              />
            </label>
          ) : foodAnalysis ? (
            <div className="foodresult">
              <div className="foodemoji">🍽️</div>
              <p>
                AI 识别结果 <i>{aiConfig.modelName}</i>
              </p>
              {foodAnalysis.items.map((item, index) => (
                <Row
                  key={`${item.name}-${index}`}
                  name={`${item.name} · ${item.portion}`}
                  cal={`${item.calories} kcal`}
                />
              ))}
              <div className="nutri">
                蛋白质 <b>{foodAnalysis.proteinG}g</b>
                <span>
                  碳水 <b>{foodAnalysis.carbsG}g</b>
                </span>
                <span>
                  脂肪 <b>{foodAnalysis.fatG}g</b>
                </span>
              </div>
              <h2>
                估算热量 <strong>{foodAnalysis.totalCalories} kcal</strong>
              </h2>
              <button className="primary" onClick={saveFood}>
                确认记录 ✓
              </button>
            </div>
          ) : null}
        </section>
      )}
      {view === "exercise" && (
        <section className="page">
          <Back
            title="记录运动"
            subtitle="选一个项目，立即完成记录"
            go={() => setView("home")}
          />
          <div className="exercisegrid">
            {exercises.map((item) => (
              <button
                key={item.activity_type}
                onClick={() => saveExercise(item)}
              >
                <span>{item.emoji}</span>
                <b>{item.activity_type}</b>
                <small>
                  {item.duration_minutes} 分钟 · {item.calories} kcal
                </small>
              </button>
            ))}
          </div>
          <p className="helper center">
            点击即记录，之后随时可以回来继续添加。
          </p>
        </section>
      )}
      {view === "trend" && (
        <section className="page">
          <header className="title">
            <p>慢慢看见你的变化</p>
            <h1>健康趋势</h1>
          </header>
          <div className="trend-tabs" aria-label="趋势范围">
            <button
              className={trendRange === 7 ? "active" : ""}
              onClick={() => {
                setTrendRange(7);
                setSelectedTrendDay(null);
              }}
            >
              最近 7 天
            </button>
            <button
              className={trendRange === 30 ? "active" : ""}
              onClick={() => {
                setTrendRange(30);
                setSelectedTrendDay(null);
              }}
            >
              最近 30 天
            </button>
          </div>
          <BloodTrend
            days={bloodTrendDays}
            selectedDay={selectedTrendDay}
            onSelect={setSelectedTrendDay}
          />
          {selectedBlood?.record && (
            <section className="trend-detail">
              <p>{selectedBlood.label} 的记录</p>
              <div>
                <span>
                  <small>血压</small>
                  <b>
                    {selectedBlood.record.systolic} / {selectedBlood.record.diastolic}
                  </b>
                  <em>mmHg</em>
                </span>
                <span>
                  <small>心率</small>
                  <b>{selectedBlood.record.heart_rate ?? "—"}</b>
                  <em>bpm</em>
                </span>
              </div>
            </section>
          )}
          <MetricTrend
            title="心率趋势"
            points={bloodTrendDays.map((day) => ({
              ...day,
              value: Number(day.record?.heart_rate ?? 0),
              hasValue: day.record?.heart_rate != null,
            }))}
            unit="bpm"
            note="记录心率后显示"
          />
          <MetricTrend
            title="摄入热量"
            points={foodTrend}
            unit="kcal"
            note="记录饮食后显示"
          />
          <MetricTrend
            title="运动消耗"
            points={exerciseTrend}
            unit="kcal"
            note="记录运动后显示"
          />
          <MetricTrend
            title="热量差"
            points={balanceTrend}
            unit="kcal"
            note="完成记录后显示"
          />
        </section>
      )}
      {view === "settings" && (
        <section className="page">
          <header className="title">
            <p>留一点空间给自己</p>
            <h1>我的</h1>
          </header>
          <div className="profilecard">
            <span className="avatar">{name}</span>
            <div>
              <b>
                {profile.gender} · {profile.age} 岁
              </b>
              <small>
                {profile.height_cm} cm · {profile.weight_kg} kg · {profile.goal}
              </small>
            </div>
            <button
              onClick={() => {
                setDraft(profile);
                setProfile(null);
              }}
            >
              编辑
            </button>
          </div>
          <div className="card bmr">
            <span>每日基础消耗估算</span>
            <strong>
              {bmr} <i>kcal / 天</i>
            </strong>
            <small>基于你的档案和日常活动计算</small>
          </div>
          <div className="card settings">
            <b>✦　AI 识别模型</b>
            <small>
              {aiConfigLoading
                ? "正在读取已保存的配置…"
                : aiConfig.configured
                  ? `已连接 · ${aiConfig.providerName} · 密钥末尾 ${aiConfig.keyHint}`
                  : "尚未连接模型"}
            </small>
            <label>
              服务商名称
              <input
                value={aiConfig.providerName}
                placeholder="例如：硅基流动"
                onChange={(event) =>
                  setAiConfig((value) => ({
                    ...value,
                    providerName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              API 链接
              <input
                value={aiConfig.baseUrl}
                placeholder="https://example.com/v1"
                inputMode="url"
                onChange={(event) =>
                  setAiConfig((value) => ({ ...value, baseUrl: event.target.value }))
                }
              />
            </label>
            <label>
              模型名称
              <input
                value={aiConfig.modelName}
                placeholder="例如：model-name"
                onChange={(event) =>
                  setAiConfig((value) => ({ ...value, modelName: event.target.value }))
                }
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={aiConfig.apiKey}
                autoComplete="off"
                placeholder={aiConfig.configured ? "留空＝保留当前 Key" : "首次保存时必填"}
                onChange={(event) =>
                  setAiConfig((value) => ({ ...value, apiKey: event.target.value }))
                }
              />
            </label>
            <button
              className="ai-save"
              disabled={aiConfigSaving || aiConfigLoading}
              onClick={saveAiConfig}
            >
              {aiConfigSaving ? "正在安全保存…" : "保存 AI 设置"}
            </button>
            <em>
              支持 OpenAI 兼容的图片识别接口。API Key 只会加密保存在腾讯云，网页不会显示它。
            </em>
          </div>
          <button className="logout" onClick={() => supabase.auth.signOut()}>
            退出登录
          </button>
        </section>
      )}
      <Nav view={view} setView={setView} />
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Choices({
  value,
  values,
  change,
}: {
  value: string;
  values: string[];
  change: (v: string) => void;
}) {
  return (
    <div className="choices">
      {values.map((v) => (
        <button
          key={v}
          className={value === v ? "chosen" : ""}
          onClick={() => change(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
function Action({
  emoji,
  title,
  detail,
  done,
  click,
}: {
  emoji: string;
  title: string;
  detail: string;
  done: boolean;
  click: () => void;
}) {
  return (
    <button className="action" onClick={click}>
      <span>{emoji}</span>
      <div>
        <b>{title}</b>
        <small>{detail}</small>
      </div>
      <i>{done ? "✓" : "›"}</i>
    </button>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span>
      <small>{label}</small>
      <b>
        {value} <i>{value === "—" ? "" : "kcal"}</i>
      </b>
    </span>
  );
}
function Calendar({
  checked,
  days,
  blanks,
  month,
  today,
}: {
  checked: Set<number>;
  days: number[];
  blanks: number;
  month: number;
  today: number;
}) {
  return (
    <section className="calendar">
      <div>
        <p>慢慢积累，就是成长</p>
        <h2>{month} 月打卡</h2>
        <strong>
          {checked.size}
          <i> 天</i>
        </strong>
      </div>
      <small>✓ 已打卡　○ 未打卡</small>
      <header>
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </header>
      <main>
        {Array.from({ length: blanks }).map((_, i) => (
          <i key={i} />
        ))}
        {days.map((day) => (
          <b
            key={day}
            className={`${checked.has(day) ? "checked" : ""} ${day > today ? "future" : ""} ${day === today ? "today" : ""}`}
          >
            {checked.has(day) ? "✓" : day}
          </b>
        ))}
      </main>
      <em>完成任意一项记录，即可点亮当天。</em>
    </section>
  );
}
function Row({ name, cal }: { name: string; cal: string }) {
  return (
    <div className="row">
      <span>{name}</span>
      <b>{cal}</b>
    </div>
  );
}
function BloodTrend({
  days,
  selectedDay,
  onSelect,
}: {
  days: Array<TrendDay & { record?: BloodRecord }>;
  selectedDay: string | null;
  onSelect: (day: string) => void;
}) {
  const records = days.flatMap((day) => (day.record ? [day.record] : []));
  const highest = Math.max(
    1,
    ...records.flatMap((record) => [record.systolic, record.diastolic]),
  );
  const height = (value: number) => `${Math.max(12, (value / highest) * 88)}%`;
  return (
    <section className="trend real-trend">
      <div className="trend-heading">
        <div>
          <h2>血压趋势</h2>
          <small>点击有记录的日期，查看血压和心率</small>
        </div>
        <span>收 / 舒</span>
      </div>
      <div className="blood-chart" role="list" aria-label="血压趋势">
        {days.map((day) => (
          <button
            type="button"
            key={day.key}
            className={`blood-day ${day.record ? "has-record" : ""} ${selectedDay === day.key ? "selected" : ""}`}
            onClick={() => day.record && onSelect(day.key)}
            aria-label={
              day.record
                ? `${day.label}：${day.record.systolic}/${day.record.diastolic}，心率 ${day.record.heart_rate ?? "未记录"}`
                : `${day.label}：未记录`
            }
          >
            <span className="blood-bars">
              {day.record && (
                <>
                  <i className="systolic" style={{ height: height(day.record.systolic) }} />
                  <i className="diastolic" style={{ height: height(day.record.diastolic) }} />
                </>
              )}
            </span>
            <small>{day.label}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function MetricTrend({
  title,
  points,
  unit,
  note,
}: {
  title: string;
  points: MetricPoint[];
  unit: string;
  note: string;
}) {
  const scale = Math.max(1, ...points.map((point) => Math.abs(point.value)));
  const latest = [...points].reverse().find((point) => point.hasValue);
  return (
    <section className="trend real-trend metric-trend">
      <div className="trend-heading">
        <div>
          <h2>{title}</h2>
          <small>{latest ? `最近记录 ${latest.value} ${unit}` : note}</small>
        </div>
      </div>
      <div className="metric-chart" aria-label={title}>
        {points.map((point) => (
          <div className="metric-day" key={point.key}>
            <i
              className={point.value < 0 ? "negative" : ""}
              style={{
                height: point.hasValue
                  ? `${Math.max(8, (Math.abs(point.value) / scale) * 86)}%`
                  : "3%",
              }}
            />
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trend({
  title,
  text,
  bars,
}: {
  title: string;
  text: string;
  bars: number[];
}) {
  return (
    <section className="trend">
      <h2>{title}</h2>
      <div>
        {bars.map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <small>{text}</small>
    </section>
  );
}
