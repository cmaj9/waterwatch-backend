/**
 * LINE Rich Menu Setup Script
 * Creates the Compact Rich Menu (2500x843 px) with 3 zones:
 * - Zone A (Left 2/3): Web Dashboard LIFF
 * - Zone B (Top Right 1/3): Node Status Summary Message ("ระดับน้ำ")
 * - Zone C (Bottom Right 1/3): Citizen Alert Settings & Registration LIFF
 *
 * Usage: node src/scripts/setupRichMenu.js
 */
require('dotenv').config();

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LIFF_ID = process.env.LINE_LIFF_ID || '2011710455-EuzadfEo';

const richMenuPayload = {
  size: {
    width: 2500,
    height: 843,
  },
  selected: true,
  name: 'WaterWatch Compact Menu',
  chatBarText: 'เมนูระบบเฝ้าระวังน้ำ',
  areas: [
    {
      bounds: {
        x: 0,
        y: 0,
        width: 1666,
        height: 843,
      },
      action: {
        type: 'uri',
        label: 'Web Dashboard',
        uri: `https://liff.line.me/${LIFF_ID}`,
      },
    },
    {
      bounds: {
        x: 1666,
        y: 0,
        width: 834,
        height: 421,
      },
      action: {
        type: 'message',
        label: 'ตรวจสถานะโหนด',
        text: 'ระดับน้ำ',
      },
    },
    {
      bounds: {
        x: 1666,
        y: 421,
        width: 834,
        height: 422,
      },
      action: {
        type: 'uri',
        label: 'ตั้งค่าการแจ้งเตือน',
        uri: `https://liff.line.me/${LIFF_ID}/register`,
      },
    },
  ],
};

async function createRichMenu() {
  if (!LINE_TOKEN) {
    console.error('[ERROR] Missing LINE_CHANNEL_ACCESS_TOKEN in .env');
    process.exit(1);
  }

  try {
    console.log('[1/3] Creating Rich Menu on LINE API...');
    const res = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify(richMenuPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[ERROR] Failed to create Rich Menu:', data);
      return;
    }

    const richMenuId = data.richMenuId;
    console.log(`[OK] Rich Menu created with ID: ${richMenuId}`);
    console.log(`[2/3] Note: To activate this Rich Menu, you can upload an image (2500x843 px) via LINE Official Account Manager or:`);
    console.log(`      curl -v -X POST https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content ...`);
    console.log(`[3/3] Setting as default Rich Menu...`);

    const defRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
    });

    if (defRes.ok) {
      console.log(`[OK] Rich Menu set as default for all users!`);
    } else {
      const defData = await defRes.text();
      console.log(`[INFO] Default set returned: ${defData} (image upload may be required first)`);
    }

    return richMenuId;
  } catch (err) {
    console.error('[ERROR]', err.message);
  }
}

if (require.main === module) {
  createRichMenu();
}

module.exports = { richMenuPayload, createRichMenu };
