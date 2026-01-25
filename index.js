require("dotenv").config();
const express = require("express");
const axios = require("axios");

// 👇ここに追加でOK
const { toUtcDate, getKigakuYear, getKigakuMonth } = require("./kigakuDate");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error("🚨 LINE_CHANNEL_ACCESS_TOKEN が設定されていません！");
  process.exit(1);
}

// ⭐ 九星気学の本命星マッピング
const nineStarKiMapping = {
  1: "一白水星",
  2: "二黒土星",
  3: "三碧木星",
  4: "四緑木星",
  5: "五黄土星",
  6: "六白金星",
  7: "七赤金星",
  8: "八白土星",
  9: "九紫火星",
};

// 🔄 本命星の計算ロジック
const calculateHonmeiStar = (year, month, day) => {
  if (month === 1 || (month === 2 && day <= 3)) {
    year -= 1;
  }
  let sum = year
    .toString()
    .split("")
    .reduce((a, b) => a + parseInt(b, 10), 0);
  while (sum > 9) {
    sum = sum
      .toString()
      .split("")
      .reduce((a, b) => a + parseInt(b, 10), 0);
  }
  return (11 - sum) % 9 || 9;
};

// 🔹 月命星の計算ロジック
const calculateGetsumeiStar = (month, honmeiStar) => {
  const table = {
    1: [6, 3, 9],
    2: [8, 5, 2],
    3: [7, 4, 1],
    4: [6, 3, 9],
    5: [5, 2, 8],
    6: [4, 1, 7],
    7: [3, 9, 6],
    8: [2, 8, 5],
    9: [1, 7, 4],
    10: [9, 6, 3],
    11: [8, 5, 2],
    12: [7, 4, 1],
  };
  const idx = [1, 4, 7].includes(honmeiStar)
    ? 0
    : [3, 6, 9].includes(honmeiStar)
      ? 1
      : 2;
  return table[month][idx];
};

// 🔄 重複時の変換
const adjustDuplicateGetsumeiStar = (honmeiStar, getsumeiStar) => {
  if (honmeiStar === getsumeiStar) {
    const conv = {1:9,2:6,3:4,4:3,5:7,6:2,7:8,8:7,9:1};
    return conv[honmeiStar];
  }
  return getsumeiStar;
};

// 🔹 本命星ごとの性格
const honmeiStarTraits = {
  1: "優しい星。冷静で直感力が鋭く忍耐強い。周囲を観察する力がある。",
  2: "穏やかで努力家。周囲と調和を大切にし、誠実。頼りにされる星",
  3: "行動力があり、新しいことに挑戦するのが得意。",
  4: "協調性が高く、調和を重視。人との関係を大切にする。",
  5: "リーダー気質があり、決断力がある。責任感が強い。",
  6: "完璧主義で論理的。効率よく物事を進める。",
  7: "社交的で明るく、楽しいことを好む。",
  8: "粘り強く、計画的に物事を進める。",
  9: "直感力が強く、頭の回転が速い。センスがある。",
};

// 🔹 月命星ごとの性格
const getsumeiStarTraits = {
  1: "慎重で冷静な判断を大切にする。",
  2: "穏やかで優しいが、慎重すぎる面も。",
  3: "活発でエネルギッシュ。自由を好む。",
  4: "協調性があり、周囲とのバランスを考える。",
  5: "強い意志を持ち、自分の考えを貫く。",
  6: "合理的で論理的に物事を判断する。",
  7: "楽観的で社交的。人との関係を楽しむ。",
  8: "粘り強く、忍耐力がある。",
  9: "直感的でセンスがある。感受性が豊か。",
};

// 🌈 開運ポイント
const generateCautionAdvice = honmeiStar => {
  const advice = {
    1: "思い込みすぎず、周囲の意見を取り入れるとより開運されます。",
    2: "慎重になりすぎず、時には思い切って行動することで運気が高まります。",
    3: "勢いだけで進まず、冷静に計画を立てることで安定した成功を引き寄せます。",
    4: "周囲に合わせるだけでなく、自分の意志を大切にすることでチャンスを掴みやすくなります。",
    5: "自分の考えを持ちながらも、人の意見を受け入れることでさらに成長し、開運に繋がります。",
    6: "完璧を求めすぎず、時にはリラックスして進めることで心の余裕が生まれ、良い流れになります。",
    7: "楽観的になりすぎず、計画的に進めることで確実に目標を達成しやすくなります。",
    8: "こだわりすぎず、視野を広げることで新たなチャンスが舞い込み、運気が上昇します。",
    9: "感情に流されるよりも、一歩引いて論理的に判断することで安定した運気を引き寄せます。",
  };
  return `🌈開運ポイント🌈\n${advice[honmeiStar]}`;
};

// 📩 Webhook 受信エンドポイント
app.post("/webhook", async (req, res) => {
  // 1) 200 OK
  res.sendStatus(200);

  // 2) トークンとテキスト取得
  const replyToken = req.body.events?.[0]?.replyToken;
  const rawText    = req.body.events?.[0]?.message?.text;
  const text       = rawText ? rawText.trim() : "";
  if (!replyToken || !text) return;

  // A: コマンド
  if (text === "宿命診断") {
    await sendReplyMessage(
      replyToken,
      "宿命診断を行います。\n" +
      "あなたの生年月日をこちらに入力してください😊\n" +
      "入力形式例：1980/1/1"
    );
    return;
  }

  // 日付チェック
  const dateRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

  // B: 正しい形式
  if (dateRegex.test(text)) {
    const [year, month, day] = text.split("/").map(v => parseInt(v, 10));
    if (
      isNaN(year) || isNaN(month) || isNaN(day) ||
      month < 1   || month > 12 ||
      day   < 1   || day   > 31
    ) {
      await sendReplyMessage(
        replyToken,
        "正しい生年月日を入力してください。（例: 1980/1/1）"
      );
      return;
    }
    // C: 鑑定（節替り対応）
let honmeiStar, getsumeiStar;

try {
  const dateUtc = toUtcDate(year, month, day);

  // 節替りで判定した気学年・気学月
  const kigakuYear  = getKigakuYear(dateUtc, year);
  const kigakuMonth = getKigakuMonth(dateUtc, year);

  
  // 本命星：気学年から算出
  honmeiStar = calculateHonmeiStarFromKigakuYear(kigakuYear);

  // 月命星：西暦月ではなく「気学月」を使う
  getsumeiStar = calculateGetsumeiStar(kigakuMonth, honmeiStar);
  getsumeiStar = adjustDuplicateGetsumeiStar(honmeiStar, getsumeiStar);

} catch (e) {
  await sendReplyMessage(
    replyToken,
    `万年暦エラー: ${e.message}`
  );
  return;
}



    const resultText =
      `宿命診断へご参加ありがとうございます😊\n\n`+
      `🔸あなたの本命星：${nineStarKiMapping[honmeiStar]}\n`+
      `🔸あなたの月命星：${nineStarKiMapping[getsumeiStar]}\n\n`+
      `🔹あなたの本質・性格🔹\n${honmeiStarTraits[honmeiStar]}\n\n`+
      `🔹あなたの内面・精神面🔹\n${getsumeiStarTraits[getsumeiStar]}\n\n`+
      `${generateCautionAdvice(honmeiStar)}\n\n`+
      `ぜひ意識してみてくださいね😊あなただけの宿命やバイオリズムなどはさらに詳しく鑑定でお話しできます。`;

    await sendReplyMessage(replyToken, resultText);
    return;
  }

  // C: 先頭数字かつ"/"含むが不正
  if (/^[0-9]/.test(text) && text.includes("/")) {
    await sendReplyMessage(
      replyToken,
      "正しい生年月日を入力してください。（例: 1980/1/1）"
    );
    return;
  }

  // D: その他 → 無応答
});

// 📩 返信関数
async function sendReplyMessage(replyToken, message) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      { replyToken, messages: [{ type: "text", text: message }] },
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } }
    );
    console.log("✅ 返信メッセージを送信しました:", message);
  } catch (error) {
    console.error("❌ メッセージ送信エラー:", error.response?.data || error.message);
  }
}

// 🚀 起動
app.listen(port, () => console.log(`🚀 サーバー起動: ${port}`));
