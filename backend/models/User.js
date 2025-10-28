// const mongoose = require("mongoose");
// const bcrypt = require("bcryptjs");

// /**
//  * User Schema
//  * Represents an application user with authentication and access control.
//  * Stores user credentials, profile information, and access permissions.
//  */
// const userSchema = new mongoose.Schema({
//   email: { 
//     type: String, 
//     required: true, 
//     unique: true // User's email address (must be unique)
//   },
//   password: { 
//     type: String, 
//     required: true // Hashed password
//   },
//   firstName: { 
//     type: String, 
//     required: true // User's first name
//   },
//   lastName: { 
//     type: String, 
//     required: true // User's last name
//   },
//   is_active: { 
//     type: Boolean, 
//     required: true, 
//     default: true // Whether the user account is active
//   },
//   is_inOffice: { 
//     type: Boolean, 
//     required: true, 
//     default: false // Whether the user account is active
//   },
//   is_admin: { 
//     type: Boolean, 
//     required: true, 
//     default: false // Whether the user has admin privileges
//   },
//   stationName: { 
//     type: String, 
//     required: true // Associated station/location name
//   },
//   access: { 
//     type: Object, 
//     default: { "news": true } // Access permissions object (feature flags)
//   },
// });

// /**
//  * Pre-save hook to hash the password before saving the user document.
//  * Only hashes if the password field has been modified.
//  */
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // Export the User model based on the schema
// module.exports = mongoose.model("User", userSchema);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User Schema
 * Includes authentication, role association, and fine-grained access permissions.
 */
const permissionNodeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  children: { type: [this], default: [] },
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  is_active: { type: Boolean, default: true, required: true },
  is_inOffice: { type: Boolean, default: false, required: true },
  is_admin: { type: Boolean, default: false, required: true },
  stationName: { type: String, required: true },

  // Reference to assigned role
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
  },
  // Temoparily keeping name permissions after frontend update change to access
  permissions: {
      type: [permissionNodeSchema],
      default: [],
  },
  access: { 
    type: Object, 
    default: { "news": true } // Access permissions object (feature flags)
  },
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model("User", userSchema);