const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function enableFTP() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Supplier = require("../models/Supplier");
  
  const supplier = await Supplier.findOne({}).select("companyName email");
  if (!supplier) {
    console.log("No suppliers found");
    await mongoose.disconnect();
    return;
  }
  
  const ftpPassword = "TestFTP123";
  const hashedPassword = await bcrypt.hash(ftpPassword, 10);
  
  await Supplier.updateOne(
    { _id: supplier._id },
    { 
      ftpEnabled: true,
      ftpUsername: "testftp",
      ftpPassword: hashedPassword
    }
  );
  
  console.log("FTP enabled for supplier:", supplier.companyName);
  console.log("FTP Username: testftp");
  console.log("FTP Password: TestFTP123");
  
  await mongoose.disconnect();
}
enableFTP();
