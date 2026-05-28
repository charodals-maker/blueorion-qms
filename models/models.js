// Data Models for Blueorion Recruitment Management System
// These represent the database schemas (tables) for the backend.
// In a real implementation, these would be Mongoose schemas for MongoDB.

// User Model (for authentication)
const UserSchema = {
  name: String, // Full name
  email: String, // Unique email
  password: String, // Hashed password
  role: String, // 'admin', 'staff', 'accounting', or 'applicant'
  createdAt: Date,
  updatedAt: Date
};

// Worker Profile Model (Sub-system #9: Profile & Contact)
// Stores applicant/candidate information
const WorkerProfileSchema = {
  userId: String, // Reference to User
  fullName: String,
  dateOfBirth: Date,
  gender: String,
  nationality: String,
  passportNumber: String,
  passportExpiry: Date,
  contactNumber: String,
  email: String, // Additional contact email
  address: String,
  skills: [String], // Array of skills
  experience: String, // Work experience description
  education: String,
  complianceStatus: String, // DMW/OWWA compliance status
  lastEditedBy: String, // User ID who last edited the record
  lastEditedAt: Date,
  createdAt: Date,
  updatedAt: Date
};

// Employer Model (Sub-system #12: FRA System)
// Stores Foreign Recruitment Agency details
const EmployerSchema = {
  name: String, // FRA company name
  country: String, // e.g., Saudi Arabia, Malaysia
  contactPerson: String,
  contactEmail: String,
  contactPhone: String,
  address: String,
  licenseNumber: String, // FRA license
  complianceStatus: String, // Compliance with DMW/OWWA
  jobOrders: [String], // Array of JobOrder IDs
  createdAt: Date,
  updatedAt: Date
};

// Job Order Model
// Tracks approved positions for international placement
const JobOrderSchema = {
  employerId: String, // Reference to Employer
  positionTitle: String,
  description: String,
  requirements: String, // Skills, experience needed
  salary: Number,
  location: String, // Country/City
  numberOfPositions: Number,
  status: String, // 'open', 'closed', 'filled'
  approvalDate: Date, // When approved by authorities
  expiryDate: Date,
  assignedWorkers: [String], // Array of WorkerProfile IDs
  createdAt: Date,
  updatedAt: Date
};

// Audit Log Model
// Tracks who edited a worker profile and when
const AuditLogSchema = {
  recordType: String, // E.g. 'WorkerProfile'
  recordId: String,
  action: String, // E.g. 'created', 'updated'
  userId: String, // User who made the change
  userRole: String, // Role of the user
  details: String, // Change description
  createdAt: Date
};

module.exports = {
  UserSchema,
  WorkerProfileSchema,
  EmployerSchema,
  JobOrderSchema,
  AuditLogSchema
};