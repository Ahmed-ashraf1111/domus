const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const PURPOSES = ["sale", "rent"];
const TYPES = ["house", "apartment", "villa", "plot", "commercial"];
const STATUSES = ["draft", "available", "reserved", "sold", "rented"];
const AREA_UNITS = ["sqft", "sqm", "marla", "kanal"];

// only these columns can be changed through the update endpoint
const UPDATABLE_FIELDS = [
  "reference_code",
  "title",
  "description",
  "purpose",
  "property_type",
  "price",
  "currency",
  "area_value",
  "area_unit",
  "bedrooms",
  "bathrooms",
  "city",
  "locality",
  "address",
  "latitude",
  "longitude",
  "amenities",
  "status",
  "assigned_agent_id",
];

function slugify(text) {
  const base = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "property") + "-" + Date.now().toString(36);
}

function toNull(value) {
  return value === "" || value === undefined ? null : value;
}

// fileUrl looks like /uploads/name.jpg
function removeFile(fileUrl) {
  const filePath = path.join(__dirname, "..", fileUrl);
  fs.unlink(filePath, () => {});
}

function validateFields(b, isCreate) {
  const has = (key) => b[key] !== undefined;

  if (isCreate || has("title")) {
    if (!b.title || !String(b.title).trim()) return "Title is required";
  }
  if (isCreate || has("purpose")) {
    if (!PURPOSES.includes(b.purpose)) return "Purpose must be sale or rent";
  }
  if (isCreate || has("property_type")) {
    if (!TYPES.includes(b.property_type)) return "Invalid property type";
  }
  if (isCreate || has("price")) {
    if (
      b.price === "" ||
      b.price === null ||
      isNaN(Number(b.price)) ||
      Number(b.price) < 0
    ) {
      return "Price must be a positive number";
    }
  }
  if (isCreate || has("city")) {
    if (!b.city || !String(b.city).trim()) return "City is required";
  }
  if (has("area_unit") && !AREA_UNITS.includes(b.area_unit))
    return "Invalid area unit";
  if (has("status") && !STATUSES.includes(b.status)) return "Invalid status";
  return null;
}

// the agent must belong to the same agency as the logged in user
async function agentBelongsToAgency(agentId, agencyId) {
  const result = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND agency_id = $2",
    [agentId, agencyId],
  );
  return result.rows.length > 0;
}

// GET /api/properties
async function list(req, res) {
  try {
    const { q, status, purpose, type, city, published } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);

    const where = ["p.agency_id = $1"];
    const values = [req.user.agency_id];

    if (q) {
      values.push(`%${q}%`);
      where.push(
        `(p.title ILIKE $${values.length}
          OR p.reference_code ILIKE $${values.length}
          OR p.city ILIKE $${values.length}
          OR p.locality ILIKE $${values.length})`,
      );
    }
    if (status) {
      values.push(status);
      where.push(`p.status = $${values.length}`);
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
    if (published === "true" || published === "false") {
      values.push(published === "true");
      where.push(`p.is_published = $${values.length}`);
    }

    const whereSql = where.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM properties p WHERE ${whereSql}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count);

    values.push(limit, (page - 1) * limit);
    const rows = await pool.query(
      `SELECT p.*,
        (SELECT m.file_url FROM property_media m
          WHERE m.property_id = p.id
          ORDER BY m.is_cover DESC, m.sort_order, m.id LIMIT 1) AS cover_image,
        u.full_name AS agent_name
       FROM properties p
       LEFT JOIN users u ON u.id = p.assigned_agent_id
       WHERE ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    res.json({ data: rows.rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List properties error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// GET /api/properties/:id
async function getOne(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid property id" });

    const result = await pool.query(
      `SELECT p.*, u.full_name AS agent_name
       FROM properties p
       LEFT JOIN users u ON u.id = p.assigned_agent_id
       WHERE p.id = $1 AND p.agency_id = $2`,
      [id, req.user.agency_id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    const media = await pool.query(
      `SELECT * FROM property_media WHERE property_id = $1
       ORDER BY is_cover DESC, sort_order, id`,
      [id],
    );

    res.json({ ...result.rows[0], media: media.rows });
  } catch (err) {
    console.error("Get property error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/properties
async function create(req, res) {
  try {
    const b = req.body;
    const error = validateFields(b, true);
    if (error) return res.status(400).json({ message: error });

    if (b.assigned_agent_id) {
      const ok = await agentBelongsToAgency(
        b.assigned_agent_id,
        req.user.agency_id,
      );
      if (!ok)
        return res.status(400).json({ message: "Assigned agent not found" });
    }

    let code = b.reference_code && String(b.reference_code).trim();
    if (!code) {
      const next = await pool.query(
        "SELECT COALESCE(MAX(id), 0) + 1 AS n FROM properties",
      );
      code = "DOM-" + String(next.rows[0].n).padStart(4, "0");
    }

    const amenities = Array.isArray(b.amenities) ? b.amenities : [];

    const result = await pool.query(
      `INSERT INTO properties
        (agency_id, reference_code, slug, title, description, purpose, property_type,
         price, currency, area_value, area_unit, bedrooms, bathrooms, city, locality,
         address, latitude, longitude, amenities, status, assigned_agent_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        req.user.agency_id,
        code,
        slugify(b.title),
        b.title.trim(),
        toNull(b.description),
        b.purpose,
        b.property_type,
        b.price,
        b.currency || "PKR",
        toNull(b.area_value),
        b.area_unit || "sqft",
        toNull(b.bedrooms),
        toNull(b.bathrooms),
        b.city.trim(),
        toNull(b.locality),
        toNull(b.address),
        toNull(b.latitude),
        toNull(b.longitude),
        amenities,
        b.status || "draft",
        toNull(b.assigned_agent_id),
        req.user.id,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Reference code already exists" });
    }
    console.error("Create property error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/properties/:id
async function update(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid property id" });

    const b = req.body;
    const error = validateFields(b, false);
    if (error) return res.status(400).json({ message: error });

    if (b.assigned_agent_id) {
      const ok = await agentBelongsToAgency(
        b.assigned_agent_id,
        req.user.agency_id,
      );
      if (!ok)
        return res.status(400).json({ message: "Assigned agent not found" });
    }

    const sets = [];
    const values = [];
    UPDATABLE_FIELDS.forEach((field) => {
      if (b[field] === undefined) return;
      if (field === "amenities") {
        values.push(Array.isArray(b.amenities) ? b.amenities : []);
      } else {
        values.push(toNull(b[field]));
      }
      sets.push(`${field} = $${values.length}`);
    });

    if (sets.length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // a draft property can never stay published
    if (b.status === "draft") sets.push("is_published = FALSE");
    sets.push("updated_at = NOW()");

    values.push(id, req.user.agency_id);
    const result = await pool.query(
      `UPDATE properties SET ${sets.join(", ")}
       WHERE id = $${values.length - 1} AND agency_id = $${values.length}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Reference code already exists" });
    }
    console.error("Update property error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/properties/:id/publish   body: { "is_published": true }
async function setPublished(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid property id" });

    const publish = req.body.is_published === true;

    const found = await pool.query(
      "SELECT id, status FROM properties WHERE id = $1 AND agency_id = $2",
      [id, req.user.agency_id],
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (publish) {
      const media = await pool.query(
        "SELECT COUNT(*) FROM property_media WHERE property_id = $1",
        [id],
      );
      if (parseInt(media.rows[0].count) === 0) {
        return res
          .status(400)
          .json({ message: "Add at least one image before publishing" });
      }
    }

    // publishing a draft makes it available
    const newStatus =
      publish && found.rows[0].status === "draft"
        ? "available"
        : found.rows[0].status;

    const result = await pool.query(
      `UPDATE properties SET is_published = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND agency_id = $4 RETURNING *`,
      [publish, newStatus, id, req.user.agency_id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Publish property error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// DELETE /api/properties/:id
async function remove(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: "Invalid property id" });

    const media = await pool.query(
      `SELECT m.file_url FROM property_media m
       JOIN properties p ON p.id = m.property_id
       WHERE p.id = $1 AND p.agency_id = $2`,
      [id, req.user.agency_id],
    );

    const result = await pool.query(
      "DELETE FROM properties WHERE id = $1 AND agency_id = $2 RETURNING id",
      [id, req.user.agency_id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Property not found" });
    }

    media.rows.forEach((row) => removeFile(row.file_url));
    res.json({ message: "Property deleted" });
  } catch (err) {
    console.error("Delete property error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// POST /api/properties/:id/media   (form-data, key: images)
async function uploadMedia(req, res) {
  const files = req.files || [];
  const cleanup = () =>
    files.forEach((f) => removeFile("/uploads/" + f.filename));

  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      cleanup();
      return res.status(400).json({ message: "Invalid property id" });
    }

    const found = await pool.query(
      "SELECT id FROM properties WHERE id = $1 AND agency_id = $2",
      [id, req.user.agency_id],
    );
    if (found.rows.length === 0) {
      cleanup();
      return res.status(404).json({ message: "Property not found" });
    }

    if (files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const stats = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE is_cover) AS covers
       FROM property_media WHERE property_id = $1`,
      [id],
    );
    let order = parseInt(stats.rows[0].total);
    let hasCover = parseInt(stats.rows[0].covers) > 0;

    const saved = [];
    for (const file of files) {
      const result = await pool.query(
        `INSERT INTO property_media (property_id, file_url, sort_order, is_cover)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, "/uploads/" + file.filename, order, !hasCover],
      );
      saved.push(result.rows[0]);
      hasCover = true;
      order++;
    }

    res.status(201).json(saved);
  } catch (err) {
    cleanup();
    console.error("Upload media error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// DELETE /api/properties/:id/media/:mediaId
async function deleteMedia(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const mediaId = parseInt(req.params.mediaId, 10);
    if (!id || !mediaId) return res.status(400).json({ message: "Invalid id" });

    const result = await pool.query(
      `DELETE FROM property_media m
       USING properties p
       WHERE m.id = $1 AND m.property_id = $2
         AND p.id = m.property_id AND p.agency_id = $3
       RETURNING m.file_url, m.is_cover`,
      [mediaId, id, req.user.agency_id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    removeFile(result.rows[0].file_url);

    // if the cover was deleted, the first remaining image becomes the cover
    if (result.rows[0].is_cover) {
      await pool.query(
        `UPDATE property_media SET is_cover = TRUE
         WHERE id = (SELECT id FROM property_media WHERE property_id = $1
                     ORDER BY sort_order, id LIMIT 1)`,
        [id],
      );
    }

    res.json({ message: "Image deleted" });
  } catch (err) {
    console.error("Delete media error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// PATCH /api/properties/:id/media/:mediaId/cover
async function setCover(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const mediaId = parseInt(req.params.mediaId, 10);
    if (!id || !mediaId) return res.status(400).json({ message: "Invalid id" });

    const found = await pool.query(
      `SELECT m.id FROM property_media m
       JOIN properties p ON p.id = m.property_id
       WHERE m.id = $1 AND p.id = $2 AND p.agency_id = $3`,
      [mediaId, id, req.user.agency_id],
    );
    if (found.rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    await pool.query(
      "UPDATE property_media SET is_cover = FALSE WHERE property_id = $1",
      [id],
    );
    await pool.query(
      "UPDATE property_media SET is_cover = TRUE WHERE id = $1",
      [mediaId],
    );

    res.json({ message: "Cover image updated" });
  } catch (err) {
    console.error("Set cover error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  setPublished,
  remove,
  uploadMedia,
  deleteMedia,
  setCover,
};
