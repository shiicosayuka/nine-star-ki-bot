require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error("🚨 LINE_CHANNEL_ACCESS_TOKEN が設定されていません！");
  process.exit(1);
}

// ...（省略: 九星気学ロジックはそのまま）...

// 📩 Webhook 受信エンドポイント
app.post("/webhook", async (req, res) => {
  // 1) まずは 200 OK
  res.sendStatus(200);

  // 2) トークンとトリム済みテキスト取得
  const replyToken = req.body.events?.[0]?.replyToken;
  const rawText    = req.body.events?.[0]?.message?.text;
  const text       = rawText ? rawText.trim() : "";
  if (!replyToken || !text) return;

  // A: コマンド「宿命診断」
  if (text === "宿命診断") {
    await sendReplyMessage(
      replyToken,
      "宿命診断を行います。\n" +
      "あなたの生年月日をこちらに入力してください😊\n" +
      "入力形式例：1980/1/1"
    );
    return;
  }

  // 日付チェック用正規表現
  const dateRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

  // B: 正しい日付形式
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
    // C: 鑑定ロジック
    const honmeiStar = calculateHonmeiStar(year, month, day);
    let getsumeiStar = calculateGetsumeiStar(month, honmeiStar);
    getsumeiStar     = adjustDuplicateGetsumeiStar(honmeiStar, getsumeiStar);

    const resultText =
      `九星診断へご参加ありがとうございます😊\n\n`+
      `🔸あなたの本命星：${nineStarKiMapping[honmeiStar]}\n`+
      `🔸あなたの月命星：${nineStarKiMapping[getsumeiStar]}\n\n`+
      `🔹あなたの本質・性格🔹\n${honmeiStarTraits[honmeiStar]}\n\n`+
      `🔹あなたの内面・精神面🔹\n${getsumeiStarTraits[getsumeiStar]}\n\n`+
      `${generateCautionAdvice(honmeiStar)}\n\n`+
      `ぜひ意識してみてくださいね😊`;

    await sendReplyMessage(replyToken, resultText);
    return;
  }

  // ┏━━━━━━━━━━━━━━━━━━┓
  // ┃ C: "先頭が数字"で"/"含むが不正 ┃
  // ┗━━━━━━━━━━━━━━━━━━┛
  if (/^[0-9]/.test(text) && text.includes("/")) {
    await sendReplyMessage(
      replyToken,
      "正しい生年月日を入力してください。（例: 1980/1/1）"
    );
    return;
  }

  // D: その他 → 無応答
});

// 📩 LINEへ返信メッセージを送る関数（省略）
// 🚀 サーバー起動（省略）
