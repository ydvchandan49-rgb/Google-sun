const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// ✅ Helper: Delay function (5 Second wait)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.post("/google-ads/webhook", async (req, res) => {
  console.log("------------------- NEW WEBHOOK CALL -------------------");
  try {
    console.log("📩 Step 1: Webhook Data Received:", JSON.stringify(req.body, null, 2));

    // ✅ Step 2: Validate Webhook Key
    if (req.body.key !== process.env.WEBHOOK_KEY) {
      console.log("❌ Invalid Webhook Key!");
      return res.status(401).json({ message: "Invalid Webhook Key" });
    }
    console.log("✅ Webhook Key Verified!");

    // ✅ Step 3: Extract Email
    const emailField = req.body.userColumnData?.find((field) => field.columnId === "EMAIL");
    const email = emailField?.stringValue;
    console.log("📧 Email:", email);

    if (!email) {
      return res.status(400).json({ message: "No email found in lead form data" });
    }

    // ✅ Step 4: Extract Campaign ID & AdGroup ID
    const campaignId = req.body.campaignId || "Not Provided";
    const adGroupId = req.body.adGroupId || "Not Provided";
    console.log("📌 Campaign ID:", campaignId);
    console.log("📌 Ad Group ID:", adGroupId);

    // ✅ Step 5: Delay for 5 seconds before talking to HubSpot
    console.log("⏳ Waiting 5 seconds before HubSpot Fetch...");
    await delay(5000);
    console.log("🟢 Proceeding to HubSpot...");

    // ✅ Step 6: Search Contact in HubSpot by Email
    console.log("🔍 Searching HubSpot for email:", email);
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
      console.log("⚠️ Contact NOT found in HubSpot. Skipping update.");
      return res.status(404).json({
        message: "Contact not found in HubSpot, not updating.",
        email,
      });
    }

    const contactId = searchResponse.data.results[0].id;
    console.log("✅ Contact Found in HubSpot:", contactId);

    // ✅ Step 7: Update Existing HubSpot Contact (No Create)
    console.log("🛠 Updating HubSpot Contact properties...");
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

    console.log("✅ Contact Successfully Updated in HubSpot!");

    return res.json({
      message: "✅ HubSpot contact updated successfully",
      contactId,
      email,
      google_campagin: campaignId,
      google_adset: adGroupId,
    });

  } catch (error) {
    console.log("❌ Error:", error.response?.data || error.message);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Webhook Active with 5s Delay + Debug Logs + Update Only Mode");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
