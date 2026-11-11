const pool = require("../config/db");

const SORTS = {
  newest: "p.created_at DESC",
  price_asc: "p.price ASC",
  price_desc: "p.price DESC",
};

// keep only digits and a leading plus sign
function cleanPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
  return cleaned || null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /api/public/properties
async function list(req, res) {
  try {
    const { q, purpose, type, city, min_price, max_price, bedrooms, sort } =
      req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 9, 1), 24);

    // only published properties are visible to visitors
    const where = ["p.is_published = TRUE"];
    const values = [];

    if (q) {
      values.push(`%${q}%`);
      const n = values.length;
      where.push(
        `(p.title ILIKE $${n} OR p.locality ILIKE $${n} OR p.city ILIKE $${n})`,
      );
    }
    if (purpose) {
      values.push(purpose);
      where.push(`p.purpose = $${values.length}`);
    }
    if (type) {
      values.push(type);
      where.push(`p.property_type = $${values.length}`);
    }
    if (city) {
      values.push(`%${city}%`);
      where.push(`p.city ILIKE $${values.length}`);
    }
    if (min_price && !isNaN(Number(min_price))) {
      values.push(Number(min_price));
      where.push(`p.price >= $${values.length}`);
    }
    if (max_price && !isNaN(Number(max_price))) {
      values.push(Number(max_price));
      where.push(`p.price <= $${values.length}`);
    }
    if (bedrooms && !isNaN(Number(bedrooms))) {
      values.push(Number(bedrooms));
      where.push(`p.bedrooms >= $${values.length}`);
    }

    const whereSql = where.join(" AND ");
    const orderSql = SORTS[sort] || SORTS.newest;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM properties p WHERE ${whereSql}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, (page - 1) * limit);
    const rows = await pool.query(
      `SELECT p.id, p.slug, p.reference_code, p.title, p.purpose, p.property_type,
              p.price, p.currency, p.area_value, p.area_unit, p.bedrooms, p.bathrooms,
              p.city, p.locality, p.status, p.created_at,
              (SELECT m.file_url FROM property_media m
                WHERE m.property_id = p.id
                ORDER BY m.is_cover DESC, m.sort_order, m.id LIMIT 1) AS cover_image
       FROM properties p
       WHERE ${whereSql}
       ORDER BY ${orderSql}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    res.json({ data: rows.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Public list error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/public/properties/featured
async function featured(req, res) {
  try {
    const rows = await pool.query(
      `SELECT p.id, p.slug, p.title, p.purpose, p.property_type, p.price, p.currency,
              p.area_value, p.area_unit, p.bedrooms, p.bathrooms, p.city, p.locality,
              p.status,
              (SELECT m.file_url FROM property_media m
                WHERE m.property_id = p.id
                ORDER BY m.is_cover DESC, m.sort_order, m.id LIMIT 1) AS cover_image
       FROM properties p
       WHERE p.is_published = TRUE
       ORDER BY p.created_at DESC
       LIMIT 6`,
    );
    res.json(rows.rows);
  } catch (err) {
    console.error("Featured error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/public/properties/:slug
async function getBySlug(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.slug, p.reference_code, p.title, p.description, p.purpose,
              p.property_type, p.price, p.currency, p.area_value, p.area_unit,
              p.bedrooms, p.bathrooms, p.city, p.locality, p.address,
              p.latitude, p.longitude, p.amenities, p.status, p.created_at,
              u.full_name AS agent_name, u.phone AS agent_phone
       FROM properties p
       LEFT JOIN users u ON u.id = p.assigned_agent_id
       WHERE p.slug = $1 AND p.is_published = TRUE`,
      [req.params.slug],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }
    const property = result.rows[0];

    const media = await pool.query(
      `SELECT id, file_url, caption, is_cover FROM property_media
       WHERE property_id = $1 ORDER BY is_cover DESC, sort_order, id`,
      [property.id],
    );

    // a few similar properties for the bottom of the page
    const similar = await pool.query(
      `SELECT p.id, p.slug, p.title, p.price, p.currency, p.city, p.bedrooms,
              p.purpose, p.property_type,
              (SELECT m.file_url FROM property_media m
                WHERE m.property_id = p.id
                ORDER BY m.is_cover DESC, m.sort_order, m.id LIMIT 1) AS cover_image
       FROM properties p
       WHERE p.is_published = TRUE AND p.id <> $1
         AND (p.city = $2 OR p.property_type = $3)
       ORDER BY (p.city = $2) DESC, p.created_at DESC
       LIMIT 3`,
      [property.id, property.city, property.property_type],
    );

    res.json({ ...property, media: media.rows, similar: similar.rows });
  } catch (err) {
    console.error("Public detail error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/public/filters  (values used to fill the search form)
async function filters(req, res) {
  try {
    const cities = await pool.query(
      `SELECT DISTINCT city FROM properties WHERE is_published = TRUE ORDER BY city`,
    );
    const range = await pool.query(
      `SELECT MIN(price) AS min_price, MAX(price) AS max_price
       FROM properties WHERE is_published = TRUE`,
    );
    res.json({
      cities: cities.rows.map((r) => r.city),
      min_price: range.rows[0].min_price,
      max_price: range.rows[0].max_price,
    });
  } catch (err) {
    console.error("Filters error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/public/agency
async function agency(req, res) {
  try {
    const result = await pool.query(
      "SELECT name, logo_url, phone, email, address FROM agencies ORDER BY id LIMIT 1",
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("Agency error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/public/inquiries
async function createInquiry(req, res) {
  const b = req.body;

  const name = b.full_name && String(b.full_name).trim();
  const phone = cleanPhone(b.phone);
  const email = b.email ? String(b.email).trim().toLowerCase() : null;

  if (!name) return res.status(400).json({ message: "Name is required" });
  if (!phone && !email) {
    return res.status(400).json({ message: "Phone or email is required" });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email address" });
  }

  const client = await pool.connect();
  try {
    let agencyId;
    let property = null;

    if (b.property_id) {
      const found = await client.query(
        `SELECT id, agency_id, assigned_agent_id, title, purpose, property_type,
                city, bedrooms, price
         FROM properties WHERE id = $1 AND is_published = TRUE`,
        [parseInt(b.property_id, 10) || 0],
      );
      if (found.rows.length === 0) {
        return res.status(404).json({ message: "Property not found" });
      }
      property = found.rows[0];
      agencyId = property.agency_id;
    } else {
      // general inquiry from the contact page goes to the main agency
      const a = await client.query(
        "SELECT id FROM agencies ORDER BY id LIMIT 1",
      );
      if (a.rows.length === 0) {
        return res.status(500).json({ message: "No agency configured" });
      }
      agencyId = a.rows[0].id;
    }

    await client.query("BEGIN");

    // reuse the contact if the same phone or email already exists in this agency
    const existing = await client.query(
      `SELECT id FROM contacts
       WHERE agency_id = $1 AND ((phone IS NOT NULL AND phone = $2)
                              OR (email IS NOT NULL AND email = $3))
       LIMIT 1`,
      [agencyId, phone, email],
    );

    let contactId;
    if (existing.rows.length > 0) {
      contactId = existing.rows[0].id;
    } else {
      const created = await client.query(
        `INSERT INTO contacts (agency_id, full_name, phone, email)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [agencyId, name, phone, email],
      );
      contactId = created.rows[0].id;
    }

    const message = b.message ? String(b.message).trim().slice(0, 2000) : null;

    const lead = await client.query(
      `INSERT INTO leads
        (agency_id, contact_id, property_id, source, message, purpose, property_type,
         preferred_city, preferred_bedrooms, assigned_agent_id)
       VALUES ($1, $2, $3, 'website', $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        agencyId,
        contactId,
        property ? property.id : null,
        message,
        property ? property.purpose : null,
        property ? property.property_type : null,
        property ? property.city : null,
        property ? property.bedrooms : null,
        property ? property.assigned_agent_id : null,
      ],
    );

    const note = property
      ? `New website inquiry about "${property.title}"`
      : "New website inquiry from the contact page";

    await client.query(
      `INSERT INTO activities (agency_id, lead_id, activity_type, body)
       VALUES ($1, $2, 'note', $3)`,
      [agencyId, lead.rows[0].id, note],
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Thank you, we will contact you soon" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Inquiry error:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
}

module.exports = { list, featured, getBySlug, filters, agency, createInquiry };
