const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
require("dotenv").config();

async function createAndEnableFTP() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Supplier = require("../models/Supplier");
  
  // Check if test supplier exists
  let supplier = await Supplier.findOne({ email: "testftp@partsform.com" }).select("+password");
  
  const webPassword = "Test123456";
  const ftpPassword = "TestFTP123";
  const hashedWebPassword = await bcrypt.hash(webPassword, 12);
  const hashedFtpPassword = crypto.createHash("sha256").update(ftpPassword).digest("hex");
  
  if (!supplier) {
    // Create a test supplier with FTP access in correct format
    // Use updateOne to avoid pre-save hook double-hashing
    supplier = new Supplier({
      companyName: "Test FTP Supplier",
      companyCode: "TESTFTP",
      contactName: "Test Contact",
      email: "testftp@partsform.com",
      phone: "+1234567890",
      isApproved: true,
      isActive: true,
    });
    await supplier.save();
    
    // Update with direct hashed values to avoid double-hashing
    await Supplier.updateOne(
      { _id: supplier._id },
      {
        password: hashedWebPassword,
        ftpAccess: {
          enabled: true,
          username: "testftp",
          password: hashedFtpPassword,
          createdAt: new Date()
        }
      }
    );
    console.log("Created new test supplier");
  } else {
    // Update existing supplier with proper credentials using updateOne
    await Supplier.updateOne(
      { _id: supplier._id },
      { 
        isActive: true,
        isApproved: true,
        password: hashedWebPassword,
        ftpAccess: {
          enabled: true,
          username: "testftp",
          password: hashedFtpPassword,
          createdAt: new Date()
        }
      }
    );
    console.log("Updated existing supplier credentials");
  }
  
  console.log("");
  console.log("=== Test Supplier Credentials ===");
  console.log("Web Login (https://partsform.com/supplier/login):");
  console.log("  Email:", "testftp@partsform.com");
  console.log("  Password:", webPassword);
  console.log("");
  console.log("FTP Access (ftp.partsform.com):");
  console.log("  Host: ftp.partsform.com");
  console.log("  Port: 21");
  console.log("  Username: testftp");
  console.log("  Password:", ftpPassword);
  
  await mongoose.disconnect();
}
createAndEnableFTP();
