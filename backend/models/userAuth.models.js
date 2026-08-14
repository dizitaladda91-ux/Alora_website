import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Name required hai"],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, "Email required hai"], 
    unique: true, 
    lowercase: true,
    trim: true
  },
  password: { 
    type: String,
    required: [true, "Password required hai"],
    minlength: [6, "Password kam se kam 6 characters ka hona chahiye!"], 
    maxlength: [100, "Password 100 characters se bada nahi ho sakta!"],
  },
  phone: { 
    type: String, 
    required: [true, "Phone number zaroori hai!"],
    unique: true, 
    trim: true,
  },
  role: {
    type: String,
    enum: ["user", "admin", "seoadmin", "affiliate"],
    default: "user"
  },
  resetToken: { type: String, default: null },
  resetTokenExpiry: { type: Date, default: null }
}, { timestamps: true });

// ✅ FIX: Async Mongoose pre-save hook without 'next' parameter
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
