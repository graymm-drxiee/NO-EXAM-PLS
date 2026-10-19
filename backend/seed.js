// Seeds local demo accounts and fleet. Do not run this against production data.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const Laptop = require("./models/Laptop");
const Loan = require("./models/Loan");

function promptSecret(label, envName) {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error(`Set ${envName} in the environment when running the seed non-interactively.`);
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Seeding cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
        } else if (char >= " " && char !== "\u007f") {
          value += char;
          output.write("*");
        }
      }
    };

    output.write(`${label}: `);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function seedPassword(envName, label) {
  const password = process.env[envName] || await promptSecret(label, envName);
  if (password.length < 12) throw new Error(`${label} must be at least 12 characters.`);
  if (Buffer.byteLength(password, "utf8") > 72) throw new Error(`${label} must be no more than 72 bytes.`);
  return password;
}

const H = 36e5;
const at = (hours) => new Date(Date.now() + hours * H);

const STUDENTS = [
  { name: "Maria Santos", studentNo: "2023-01482", program: "BS Computer Science", address: "Brgy. Sample, Tabaco City, Albay", contact: "09171234567", year: "3rd Year", block: "A" },
  { name: "Jose Rizal", studentNo: "2022-00891", program: "BS Information Technology major in Animation", address: "Brgy. Poblacion, Legazpi City, Albay", contact: "09182223333", year: "4th Year", block: "B" },
  { name: "Andres Bonifacio", studentNo: "2024-00312", program: "BS Information Systems", address: "Brgy. San Roque, Daraga, Albay", contact: "09193334444", year: "2nd Year", block: "C", active: false },
];

const LAPTOPS = [
  { tag: "CSD-LT-001", model: "Lenovo ThinkPad E14", cpu: "Core i5", ram: "16 GB", storage: "512 GB SSD", maintenance: false },
  { tag: "CSD-LT-002", model: "Dell Inspiron 15", cpu: "Core i5", ram: "8 GB", storage: "256 GB SSD", maintenance: false },
  { tag: "CSD-LT-003", model: "Acer Aspire 5", cpu: "Ryzen 5", ram: "16 GB", storage: "512 GB SSD", maintenance: false },
  { tag: "CSD-LT-004", model: "HP ProBook 450", cpu: "Core i7", ram: "16 GB", storage: "1 TB SSD", maintenance: true },
  { tag: "CSD-LT-005", model: "ASUS VivoBook 15", cpu: "Ryzen 7", ram: "16 GB", storage: "512 GB SSD", maintenance: false },
  { tag: "CSD-LT-006", model: "Lenovo IdeaPad 3", cpu: "Core i3", ram: "8 GB", storage: "256 GB SSD", maintenance: false },
];

const LOANS = [
  { student: "2023-01482", tag: "CSD-LT-001", start: at(-20), end: at(28), purpose: "Thesis coding" },
  { student: "2023-01482", tag: "CSD-LT-003", start: at(96), end: at(120), purpose: "Capstone demo" },
  { student: "2023-01482", tag: "CSD-LT-002", start: at(-400), end: at(-380), purpose: "Programming exam", returned: true },
  { student: "2022-00891", tag: "CSD-LT-002", start: at(-5), end: at(30), purpose: "Research" },
  { student: "2022-00891", tag: "CSD-LT-005", start: at(-72), end: at(-24), purpose: "Hackathon", returned: true },
  { student: "2024-00312", tag: "CSD-LT-006", start: at(-96), end: at(-48), purpose: "Lab work", returned: true },
  { student: "2024-00312", tag: "CSD-LT-005", start: at(-100), end: at(-4), purpose: "Missed return" },
];

(async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Demo seeding is disabled in production.");
    }
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required to seed data.");
    const adminPasswordPlain = await seedPassword("ADMIN_PASSWORD", "Admin password");
    const studentPasswordPlain = await seedPassword("SEED_STUDENT_PASSWORD", "Seed student password");

    await mongoose.connect(process.env.MONGODB_URI);

    const adminPassword = await bcrypt.hash(adminPasswordPlain, 10);
    await User.updateOne(
      { username: (process.env.ADMIN_USERNAME || "admin").toLowerCase() },
      {
        $set: {
          name: process.env.ADMIN_NAME || "CSD Admin",
          username: (process.env.ADMIN_USERNAME || "admin").toLowerCase(),
          password: adminPassword,
          role: "admin",
          active: true,
        },
      },
      { upsert: true }
    );

    const studentPassword = await bcrypt.hash(studentPasswordPlain, 10);
    for (const s of STUDENTS) {
      await User.updateOne(
        { studentNo: s.studentNo },
        { $set: { ...s, password: studentPassword, role: "student" } },
        { upsert: true }
      );
    }

    for (const laptop of LAPTOPS) {
      await Laptop.updateOne({ tag: laptop.tag }, { $set: laptop }, { upsert: true });
    }

    if ((await Loan.countDocuments()) === 0) {
      const users = await User.find({ role: "student" });
      const laptops = await Laptop.find();
      const byNo = Object.fromEntries(users.map((u) => [u.studentNo, u._id]));
      const byTag = Object.fromEntries(laptops.map((l) => [l.tag, l._id]));

      await Loan.insertMany(
        LOANS.map((l) => ({
          studentId: byNo[l.student],
          laptopId: byTag[l.tag],
          start: l.start,
          end: l.end,
          purpose: l.purpose,
          returned: Boolean(l.returned),
        }))
      );
      console.log(`Seeded ${LOANS.length} loans`);
    }

    console.log("Seed complete.");
    console.log(`  admin username: ${process.env.ADMIN_USERNAME || "admin"}`);
    console.log(`  seeded student ID: ${STUDENTS[0].studentNo}`);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
