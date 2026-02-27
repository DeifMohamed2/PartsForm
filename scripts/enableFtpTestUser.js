const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
require("dotenv").config();

async function createAndEnableFTP() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Supplier = require("../models/Supplier");
  
  // Check if test supplier exists
  let supplier = await Supplier.findOne({ email: "testftp@partsform.com" });
  
  if (!supplier) {
    // Create a test supplier with FTP access in correct format
    const passwordHash = await bcrypt.hash("Test123456", 10);
    supplier = await Supplier.create({
      companyName: "Test FTP Supplier",
      companyCode: "TESTFTP",
      contactName: "Test Contact",
      email: "testftp@partsform.com",
      password: passwordHash,
      phone: "+1234567890",
      isApproved: true,
      isActive: true,
      ftpAccess: {
        enabled: true,
        username: "testftp",
        password: "TestFTP123", // Will be hashed by pre-save hook
        createdAt: new Date()
      }
    });
    console.log("Created new test supplier");
  } else {
    // Update existing supplier with proper ftpAccess structure
    await Supplier.updateOne(
      { _id: supplier._id },
      { 
        isActive: true,
        ftpAccess: {
          enabled: true,
          username: "testftp",
          password: crypto.createHash("sha256").update("TestFTP123").digest("hex"),
          createdAt: new Date()
        }
      }
    );
    console.log("Updated existing supplier FTP access");
  }
  
  console.log("FTP enabled for:", supplier.companyName);
  console.log("FTP Username: testftp");
  console.log("FTP Password: TestFTP123");
  console.log("Server: partsform.com");
  console.log("Port: 21");
  
  await mongoose.disconnect();
}
createAndEnableFTP();
