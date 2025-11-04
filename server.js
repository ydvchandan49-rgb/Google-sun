const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/google-ads/webhook", async (req, res) => {
  try {
    console.log("📩 Incoming Lead Form Data:", req.body);

    // ✅ 1. Validate Webhook Key
    const receivedKey = req.body.key;
    if (receivedKey !== process.env.WEBHOOK_KEY) {
      return res.status(401).json({ message: "❌ Invalid Webhook Key" });
    }

    // ✅ 2. Extract Email from Google Lead Form
    const emailField = req.body.userColumnData?.find(
      (field) => field.columnId === "EMAIL"
    );
    const email = emailField?.stringValue;

    if (!email) {
      return res.status(400).json({ message: "❌ Email not found in lead data" });
    }

    // ✅ 3. Capture Campaign + AdGroup ID
    const campaignId = req.body.campaignId || "";
    const adGroupId = req.body.adGroupId || "";

    // ✅ 4. Search Contact in HubSpot (Only Update if Exists)
    const searchResponse = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: email,
              },
            ],
          },
        ],
        limit: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (searchResponse.data.total === 0) {
      console.log("⚠️ Contact not found in HubSpot, skipping update.");
      return res.status(404).json({
        message: "⚠️ Contact not found in HubSpot. Not creating a new one.",
        email,
      });
    }

    const contactId = searchResponse.data.results[0].id;

    // ✅ 5. Only update existing contact (No Create)
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        properties: {
          google_campagin: campaignId,
          google_adset: adGroupId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      message: "✅ Existing Contact Updated Successfully!",
      contactId,
      email,
      google_campagin: campaignId,
      google_adset: adGroupId,
    });

  } catch (error) {
    console.error("❌ Error in Webhook:", error.response?.data || error);
    res.status(500).json({ message: "❌ Server Error", error: error.message });
  }
});

// ✅ Default Route
app.get("/", (req, res) => {
  res.send("🚀 Google Ads → HubSpot Webhook is Running (Update only, No Create)");
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
