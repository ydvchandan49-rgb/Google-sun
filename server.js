
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/google-ads/webhook", async (req, res) => {
  try {
    const { email, campaignName, adsetName } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required!" });
    }

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
        properties: ["email"],
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
      return res.status(404).json({ message: "Contact not found in HubSpot" });
    }

    const contactId = searchResponse.data.results[0].id;

    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
      {
        properties: {
          google_campagin: campaignName || "",
          google_adset: adsetName || "",
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
      message: "Contact updated successfully!",
      contactId,
      updated: { google_campagin: campaignName, google_adset: adsetName },
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Server is running! Google Ads → HubSpot");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
