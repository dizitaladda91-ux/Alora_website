import dotenv from "dotenv";
import db from "../config/db.js";
import User from "../models/userAuth.models.js";

dotenv.config();

const staffAccounts = [
  {
    label: "admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
    name: "Alora Admin"
  },
  {
    label: "SEO admin",
    email: process.env.SEO_EMAIL,
    password: process.env.SEO_PASSWORD,
    role: "seoadmin",
    name: "Alora SEO Admin"
  }
];

const validateAccount = ({ label, email, password }) => {
  if (!email && !password) return false;
  if (!email || !password) {
    throw new Error(`${label}: both email and password must be configured.`);
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw new Error(`${label}: a valid email is required.`);
  }
  if (password.length < 12) {
    throw new Error(`${label}: use a password of at least 12 characters before bootstrapping.`);
  }
  return true;
};

const bootstrapAccount = async (account) => {
  const email = account.email.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    existing.name = account.name;
    existing.role = account.role;
    existing.password = account.password;
    await existing.save();
    console.log(`Updated ${account.label} account: ${email}`);
    return;
  }

  // Staff accounts do not use phone login. This internal, unique identifier
  // satisfies the current required phone field without storing a fake real number.
  await User.create({
    name: account.name,
    email,
    password: account.password,
    phone: `staff-${account.role}-${email}`,
    role: account.role
  });
  console.log(`Created ${account.label} account: ${email}`);
};

try {
  await db();
  let processed = 0;
  for (const account of staffAccounts) {
    if (!validateAccount(account)) continue;
    await bootstrapAccount(account);
    processed += 1;
  }

  if (processed === 0) {
    throw new Error("No staff account is configured. Set ADMIN_EMAIL/ADMIN_PASSWORD or SEO_EMAIL/SEO_PASSWORD temporarily.");
  }

  console.log("Staff bootstrap completed. Remove ADMIN_PASSWORD and SEO_PASSWORD from runtime environment variables before deploying.");
  process.exitCode = 0;
} catch (error) {
  console.error("Staff bootstrap failed:", error.message);
  process.exitCode = 1;
} finally {
  await User.db.close();
}
