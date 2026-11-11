require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./config/db");

const IMAGES_DIR = path.join(__dirname, "demo-images");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// the newest listings come first, so the best ones show on the home page
const PROPERTIES = [
  {
    title: "Luxury Villa with Private Pool in DHA Phase 6",
    description:
      "A modern villa with a private swimming pool, a large garden and a spacious open living area. Quiet street and close to schools and shopping.",
    purpose: "sale",
    type: "villa",
    price: 185000000,
    area_value: 2,
    area_unit: "kanal",
    bedrooms: 5,
    bathrooms: 6,
    city: "Lahore",
    locality: "DHA Phase 6",
    address: "Street 12, DHA Phase 6",
    amenities: [
      "Pool",
      "Garden",
      "Parking",
      "Security",
      "Generator",
      "Air conditioning",
    ],
    status: "available",
    images: ["villa-2.jpg"],
  },
  {
    title: "Modern Family House in Bahria Town",
    description:
      "A bright family house with a double garage and a covered porch. Well planned rooms and a safe gated community.",
    purpose: "sale",
    type: "house",
    price: 62000000,
    area_value: 10,
    area_unit: "marla",
    bedrooms: 4,
    bathrooms: 4,
    city: "Islamabad",
    locality: "Bahria Town",
    address: "Phase 4, Bahria Town",
    amenities: ["Parking", "Security", "Garden", "Generator"],
    status: "available",
    images: ["house-1.jpg"],
  },
  {
    title: "Two Bedroom Apartment in Gulberg Greens",
    description:
      "A well kept apartment on a high floor with a nice view. Close to the main road and the market.",
    purpose: "sale",
    type: "apartment",
    price: 32000000,
    area_value: 1350,
    area_unit: "sqft",
    bedrooms: 2,
    bathrooms: 2,
    city: "Islamabad",
    locality: "Gulberg Greens",
    address: "Block C, Gulberg Greens",
    amenities: ["Elevator", "Parking", "Security", "Balcony", "Gym"],
    status: "available",
    images: ["apartment-1.jpg", "interior.jpg"],
  },
  {
    title: "Spacious House with Green Lawn",
    description:
      "A large house with a front lawn and a quiet neighbourhood. Suitable for a big family.",
    purpose: "sale",
    type: "house",
    price: 48500000,
    area_value: 400,
    area_unit: "sqm",
    bedrooms: 5,
    bathrooms: 4,
    city: "Karachi",
    locality: "Gulistan-e-Johar",
    address: "Block 15, Gulistan-e-Johar",
    amenities: ["Garden", "Parking", "Security", "Air conditioning"],
    status: "available",
    images: ["house-3.jpg"],
  },
  {
    title: "Contemporary Villa in Gulberg",
    description:
      "A modern villa with clean lines, large windows and a covered terrace. Already reserved by a buyer.",
    purpose: "sale",
    type: "villa",
    price: 98000000,
    area_value: 1,
    area_unit: "kanal",
    bedrooms: 4,
    bathrooms: 5,
    city: "Lahore",
    locality: "Gulberg III",
    address: "Main Boulevard, Gulberg III",
    amenities: ["Parking", "Security", "Balcony", "Air conditioning"],
    status: "reserved",
    images: ["villa-1.jpg"],
  },
  {
    title: "Three Bedroom House near the Park",
    description:
      "A comfortable house for rent next to a green park. Tiled floors, a big kitchen and a small garden.",
    purpose: "rent",
    type: "house",
    price: 120000,
    area_value: 8,
    area_unit: "marla",
    bedrooms: 3,
    bathrooms: 3,
    city: "Lahore",
    locality: "Johar Town",
    address: "Block E, Johar Town",
    amenities: ["Parking", "Garden", "Generator"],
    status: "available",
    images: ["house-2.jpg"],
  },
  {
    title: "Family Apartment for Rent in Clifton",
    description:
      "A spacious apartment in a secure building with a lift and covered parking. Walking distance to shops.",
    purpose: "rent",
    type: "apartment",
    price: 150000,
    area_value: 1600,
    area_unit: "sqft",
    bedrooms: 3,
    bathrooms: 3,
    city: "Karachi",
    locality: "Clifton Block 4",
    address: "Clifton Block 4",
    amenities: [
      "Elevator",
      "Parking",
      "Security",
      "Gym",
      "Generator",
      "Balcony",
    ],
    status: "available",
    images: ["apartment-2.jpg"],
  },
  {
    title: "Furnished Apartment in Gulberg",
    description:
      "A fully furnished apartment ready to move in. Currently rented out.",
    purpose: "rent",
    type: "apartment",
    price: 95000,
    area_value: 1100,
    area_unit: "sqft",
    bedrooms: 2,
    bathrooms: 2,
    city: "Lahore",
    locality: "Gulberg II",
    address: "Gulberg II",
    amenities: [
      "Furnished",
      "Elevator",
      "Security",
      "Parking",
      "Air conditioning",
    ],
    status: "rented",
    images: ["apartment-3.jpg"],
  },
];

function slugify(text, index) {
  const base = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base + "-" + (Date.now() + index).toString(36);
}

// copy one demo image into the uploads folder and return its public url
function copyImage(fileName) {
  const newName =
    "demo-" +
    Date.now() +
    "-" +
    Math.round(Math.random() * 1e6) +
    "-" +
    fileName;
  fs.copyFileSync(
    path.join(IMAGES_DIR, fileName),
    path.join(UPLOADS_DIR, newName),
  );
  return "/uploads/" + newName;
}

async function seedDemo() {
  const client = await pool.connect();
  const copied = [];

  try {
    const agency = await client.query(
      "SELECT id FROM agencies WHERE slug = $1",
      ["domus-demo"],
    );
    if (agency.rows.length === 0) {
      console.log("Agency not found, run seed.js first");
      return;
    }
    const agencyId = agency.rows[0].id;

    const admin = await client.query(
      "SELECT id FROM users WHERE email = $1 AND agency_id = $2",
      ["admin@domus.com", agencyId],
    );
    const agent = await client.query(
      "SELECT id FROM users WHERE email = $1 AND agency_id = $2",
      ["agent@domus.com", agencyId],
    );
    if (admin.rows.length === 0 || agent.rows.length === 0) {
      console.log("Admin or agent user not found, run seed.js first");
      return;
    }

    // do nothing if the demo data was already added
    const already = await client.query(
      "SELECT id FROM properties WHERE agency_id = $1 AND title = $2",
      [agencyId, PROPERTIES[0].title],
    );
    if (already.rows.length > 0) {
      console.log("Demo properties already exist, nothing to do");
      return;
    }

    // make sure every image file exists before touching the database
    const missing = [];
    PROPERTIES.forEach((p) =>
      p.images.forEach((name) => {
        if (!fs.existsSync(path.join(IMAGES_DIR, name))) missing.push(name);
      }),
    );
    if (missing.length > 0) {
      console.log("Missing images in demo-images: " + missing.join(", "));
      return;
    }

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

    await client.query("BEGIN");

    const maxId = await client.query(
      "SELECT COALESCE(MAX(id), 0) AS n FROM properties",
    );
    let codeNumber = Number(maxId.rows[0].n);

    for (let i = 0; i < PROPERTIES.length; i++) {
      const p = PROPERTIES[i];
      codeNumber += 1;
      const code = "DOM-" + String(codeNumber).padStart(4, "0");
      // one hour apart so the order on the site is stable
      const createdAt = new Date(Date.now() - i * 60 * 60 * 1000);

      const inserted = await client.query(
        `INSERT INTO properties
          (agency_id, reference_code, slug, title, description, purpose, property_type,
           price, currency, area_value, area_unit, bedrooms, bathrooms, city, locality,
           address, amenities, status, is_published, assigned_agent_id, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PKR',$9,$10,$11,$12,$13,$14,$15,$16,$17,TRUE,$18,$19,$20)
         RETURNING id`,
        [
          agencyId,
          code,
          slugify(p.title, i),
          p.title,
          p.description,
          p.purpose,
          p.type,
          p.price,
          p.area_value,
          p.area_unit,
          p.bedrooms,
          p.bathrooms,
          p.city,
          p.locality,
          p.address,
          p.amenities,
          p.status,
          agent.rows[0].id,
          admin.rows[0].id,
          createdAt,
        ],
      );
      const propertyId = inserted.rows[0].id;

      for (let j = 0; j < p.images.length; j++) {
        const url = copyImage(p.images[j]);
        copied.push(url);
        await client.query(
          `INSERT INTO property_media (property_id, file_url, sort_order, is_cover)
           VALUES ($1, $2, $3, $4)`,
          [propertyId, url, j, j === 0],
        );
      }
    }

    await client.query("COMMIT");
    console.log("Demo seed done: " + PROPERTIES.length + " properties added");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // remove the images copied before the error
    copied.forEach((url) => fs.unlink(path.join(__dirname, url), () => {}));
    console.error("Demo seed failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemo();
