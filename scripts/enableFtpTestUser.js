const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function createAndEnableFTP() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Supplier = require("../models/Supplier");
  
  // Check if test supplier exists
  let supplier = await Supplier.findOne({ email: "testftp@partsform.com" });
  
  if (!supplier) {
    // Create a test supplier
    const passwordHash = await bcrypt.hash("Test123456", 10);
    supplier = await Supplier.create({
      companyName: "Test FTP Supplier",
      email: "testftp@partsform.com",
      password: passwordHash,
      phone: "+1234567890",
      isApproved: true,
      ftpEnabled: true,
      ftpUsername: "testftp",
      ftpPassword: await bcrypt.hash("TestFTP123", 10)
    });
    console.log("Created new test supplier");
  } else {
    // Update existing supplier
    await Supplier.updateOne(
      { _id: supplier._id },
      { 
        ftpEnabled: true,
        ftpUsername: "testftp",
        ftpPassword: await bcrypt.hash("TestFTP123", 10)
      }
    );
    console.log("Updated existing supplier");
  }
  
  console.log("FTP enabled for:", supplier.companyName);
  console.log("FTP Username: testftp");
  console.log("FTP Password: TestFTP123");
  
  await mongoose.disconnect();
}
createAndEnableFTP();
