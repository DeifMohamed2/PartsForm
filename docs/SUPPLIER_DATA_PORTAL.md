# Supplier Data Portal - Feature Documentation

## Overview

The Supplier Data Portal is a comprehensive data management system that allows suppliers to upload, manage, and export their product data through an intuitive Excel-like interface. The system integrates seamlessly with the admin panel for oversight and approval workflows.

## Table of Contents

1. [Architecture](#architecture)
2. [Supplier Portal Features](#supplier-portal-features)
3. [Admin Management Features](#admin-management-features)
4. [Data Flow](#data-flow)
5. [API Reference](#api-reference)
6. [Database Models](#database-models)
7. [Security](#security)
8. [Configuration](#configuration)

---

## Architecture

### Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Spreadsheet UI**: Handsontable (Excel-like grid)
- **File Processing**: CSV/Excel parsing with streaming
- **Export Formats**: CSV, Excel, JSON
- **SFTP Integration**: Automated exports to external servers
- **Authentication**: JWT-based with role permissions

### Directory Structure

```
├── models/
│   ├── Supplier.js          # Supplier accounts
│   ├── DataTable.js         # Data tables (spreadsheets)
│   ├── DataRecord.js        # Individual records
│   ├── AuditLog.js          # Activity tracking
│   └── DataExport.js        # Export history
├── controllers/
│   ├── supplierAuthController.js    # Auth (login/register)
│   ├── supplierDataController.js    # Data CRUD operations
│   ├── supplierViewController.js    # Page rendering
│   └── adminSupplierController.js   # Admin management
├── services/
│   ├── supplierDataService.js       # Data operations
│   ├── supplierDataImportService.js # File import processing
│   ├── sftpExportService.js         # SFTP automation
│   └── supplierExportScheduler.js   # Scheduled exports
├── routes/
│   ├── supplier.js          # API routes
│   └── supplierViews.js     # View routes
├── views/supplier/
│   ├── dashboard.ejs        # Main dashboard
│   ├── tables.ejs           # Tables list
│   ├── spreadsheet.ejs      # Editor view
│   ├── import.ejs           # File import
│   ├── exports.ejs          # Export history
│   ├── sftp.ejs             # SFTP settings
│   ├── api.ejs              # API keys
│   ├── team.ejs             # Team management
│   ├── audit.ejs            # Audit logs
│   ├── settings.ejs         # Account settings
│   └── login.ejs            # Login/register
└── public/css/supplierCSS/
    ├── supplier-main.css        # Core layout
    ├── supplier-components.css  # UI components
    ├── supplier-dashboard.css   # Dashboard widgets
    ├── supplier-spreadsheet.css # Handsontable styles
    ├── supplier-import.css      # Import wizard
    ├── supplier-login.css       # Auth pages
    └── supplier-pages.css       # Other pages
```

---

## Supplier Portal Features

### 1. Dashboard
- **Welcome Banner**: Quick overview of account status
- **Quick Actions**: Create table, import data, manage exports
- **Statistics**: Total tables, records, recent activity
- **Activity Feed**: Real-time updates on data changes
- **Usage Charts**: Visual data usage over time

### 2. Data Tables Management
- **Create Tables**: Define name, description, columns
- **Column Types**: Text, Number, Date, Boolean, Select
- **Table Status**: Draft, Active, Archived
- **Bulk Operations**: Delete multiple tables

### 3. Spreadsheet Editor (Handsontable)
- **Excel-like Interface**: Familiar spreadsheet experience
- **Cell Operations**: Copy, paste, cut, fill down/right
- **Column Operations**: Add, delete, reorder, resize
- **Data Validation**: Type checking, required fields
- **Search & Filter**: Find data quickly
- **Undo/Redo**: Version history support
- **Auto-save**: Changes saved automatically
- **Context Menu**: Right-click operations
- **Keyboard Shortcuts**: Standard Excel shortcuts

### 4. Data Import
- **Supported Formats**: CSV, Excel (.xlsx, .xls)
- **Drag & Drop**: Easy file upload
- **Column Mapping**: Match import columns to table columns
- **Preview**: Review data before import
- **Validation**: Check for errors before commit
- **Progress Tracking**: Real-time import status
- **Error Handling**: Detailed error reports

### 5. Data Export
- **Export Formats**: CSV, Excel, JSON
- **Custom Selection**: Choose columns to export
- **Filtering**: Export specific records
- **Scheduling**: Automated recurring exports
- **Download History**: Track all exports

### 6. SFTP Integration
- **Server Configuration**: Host, port, credentials
- **Path Settings**: Remote directory paths
- **Test Connection**: Verify settings
- **Scheduled Exports**: Automated uploads
- **Export Logs**: Track upload history

### 7. API Access
- **API Keys**: Generate/revoke access keys
- **Key Permissions**: Read, Write, Delete
- **Rate Limiting**: Configurable limits
- **Usage Analytics**: Track API calls
- **Documentation**: In-app API docs

### 8. Team Management
- **Invite Members**: Email-based invitations
- **Role Assignment**: Admin, Editor, Viewer
- **Permission Control**: Fine-grained access
- **Activity Tracking**: Per-user audit trail

### 9. Audit Logging
- **Comprehensive Logs**: All actions tracked
- **Filter by Action**: Create, Update, Delete, Export
- **Date Range**: Filter by time period
- **Export Logs**: Download audit history
- **IP Tracking**: Security monitoring

### 10. Account Settings
- **Profile Management**: Company info, contact details
- **Password Change**: Secure password updates
- **Notification Preferences**: Email alerts
- **Data Retention**: Auto-cleanup settings

---

## Admin Management Features

### 1. Suppliers List (`/admin/suppliers`)
- **View All Suppliers**: Paginated list with search
- **Status Filtering**: Active, Pending, Suspended, Rejected
- **Bulk Actions**: Approve, suspend, reject multiple suppliers
- **Export List**: Download supplier data as CSV
- **Quick Stats**: Total, active, pending counts

### 2. Supplier Details (`/admin/suppliers/:id`)
- **Overview Tab**:
  - Company information
  - Account activity
  - Data usage statistics
  - Address information

- **Data Tables Tab**:
  - View all supplier tables
  - Record counts and column info
  - Last update timestamps

- **Exports Tab**:
  - Export history
  - File formats and sizes
  - Download status

- **Audit Log Tab**:
  - Complete activity history
  - Filtered by action type
  - Timestamp and IP tracking

- **Limits Tab**:
  - Max tables allowed
  - Max records per table
  - Monthly export limit
  - Daily API call limit

### 3. Approval Workflow
- **Pending Queue**: New registrations awaiting review
- **Approve**: Activate supplier account
- **Reject**: Decline with reason
- **Badge Counter**: Pending count in sidebar

### 4. Account Actions
- **Suspend**: Temporarily disable account (with reason)
- **Reactivate**: Re-enable suspended account
- **Delete**: Soft delete (recoverable)
- **Permanent Delete**: Remove all data

---

## Data Flow

### 1. Supplier Registration Flow
```
Supplier Registers → Status: Pending → Admin Reviews
                                              ↓
                                    Approve → Status: Active (can login)
                                              ↓
                                    Reject  → Status: Rejected (notified)
```

### 2. Data Import Flow
```
Upload File → Parse → Preview → Map Columns → Validate → Import → Audit Log
```

### 3. Data Export Flow
```
Select Data → Choose Format → Generate → Store → Download/SFTP → Audit Log
```

### 4. SFTP Scheduled Export Flow
```
Cron Trigger → Fetch Data → Generate File → Connect SFTP → Upload → Log Result
```

---

## API Reference

### Authentication
```
POST /api/supplier/auth/login       # Login
POST /api/supplier/auth/register    # Register new account
POST /api/supplier/auth/logout      # Logout
POST /api/supplier/auth/refresh     # Refresh token
```

### Data Tables
```
GET    /api/supplier/tables              # List all tables
POST   /api/supplier/tables              # Create table
GET    /api/supplier/tables/:id          # Get table details
PUT    /api/supplier/tables/:id          # Update table
DELETE /api/supplier/tables/:id          # Delete table
```

### Records
```
GET    /api/supplier/tables/:id/records      # Get records (paginated)
POST   /api/supplier/tables/:id/records      # Add record(s)
PUT    /api/supplier/tables/:id/records/:rid # Update record
DELETE /api/supplier/tables/:id/records/:rid # Delete record
POST   /api/supplier/tables/:id/records/bulk # Bulk operations
```

### Import/Export
```
POST /api/supplier/import                # Import from file
GET  /api/supplier/exports               # List exports
POST /api/supplier/exports               # Create export
GET  /api/supplier/exports/:id/download  # Download export
```

### SFTP
```
GET  /api/supplier/sftp/config           # Get SFTP settings
PUT  /api/supplier/sftp/config           # Update settings
POST /api/supplier/sftp/test             # Test connection
GET  /api/supplier/sftp/exports          # List SFTP exports
```

### Team
```
GET    /api/supplier/team                # List team members
POST   /api/supplier/team/invite         # Invite member
PUT    /api/supplier/team/:id            # Update member
DELETE /api/supplier/team/:id            # Remove member
```

### Admin API
```
GET    /admin/api/suppliers              # List suppliers
GET    /admin/api/suppliers/stats        # Get statistics
PUT    /admin/api/suppliers/:id/approve  # Approve supplier
PUT    /admin/api/suppliers/:id/reject   # Reject supplier
PUT    /admin/api/suppliers/:id/suspend  # Suspend supplier
PUT    /admin/api/suppliers/:id/reactivate # Reactivate
DELETE /admin/api/suppliers/:id          # Delete supplier
PUT    /admin/api/suppliers/:id/limits   # Update quotas
```

---

## Database Models

### Supplier
```javascript
{
  companyName: String,
  email: String (unique),
  password: String (hashed),
  contactPerson: String,
  phone: String,
  website: String,
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  status: ['pending', 'active', 'suspended', 'rejected'],
  team: [{ user: ObjectId, role: String, invitedAt: Date }],
  apiKeys: [{ key: String, name: String, permissions: [String] }],
  sftpConfig: {
    host: String,
    port: Number,
    username: String,
    password: String (encrypted),
    remotePath: String
  },
  limits: {
    maxTables: Number,
    maxRecordsPerTable: Number,
    maxExportsPerMonth: Number,
    maxApiCallsPerDay: Number
  },
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### DataTable
```javascript
{
  supplier: ObjectId (ref: Supplier),
  name: String,
  description: String,
  columns: [{
    name: String,
    type: ['text', 'number', 'date', 'boolean', 'select'],
    required: Boolean,
    options: [String] // for select type
  }],
  status: ['draft', 'active', 'archived'],
  recordCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### DataRecord
```javascript
{
  table: ObjectId (ref: DataTable),
  data: Mixed, // key-value pairs matching columns
  version: Number,
  createdBy: ObjectId,
  updatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### AuditLog
```javascript
{
  supplier: ObjectId (ref: Supplier),
  user: ObjectId,
  action: String,
  resource: String,
  resourceId: ObjectId,
  details: Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
```

### DataExport
```javascript
{
  supplier: ObjectId (ref: Supplier),
  table: ObjectId (ref: DataTable),
  format: ['csv', 'excel', 'json'],
  fileName: String,
  filePath: String,
  fileSize: Number,
  recordCount: Number,
  status: ['pending', 'processing', 'completed', 'failed'],
  destination: ['download', 'sftp'],
  sftpResult: {
    success: Boolean,
    error: String,
    uploadedAt: Date
  },
  createdBy: ObjectId,
  createdAt: Date
}
```

---

## Security

### Authentication
- JWT tokens with secure httpOnly cookies
- Password hashing with bcrypt (salt rounds: 12)
- Session management with refresh tokens
- Account lockout after failed attempts

### Authorization
- Role-based access control (RBAC)
- Permission checks on all API endpoints
- Supplier isolation (can only access own data)
- Admin permission requirements

### Data Protection
- SFTP passwords encrypted at rest
- API keys hashed before storage
- Audit logging of all data access
- Rate limiting on API endpoints

### Input Validation
- Schema validation on all inputs
- File type verification for imports
- Size limits on uploads
- XSS prevention in responses

---

## Configuration

### Environment Variables
```env
# Supplier Portal
SUPPLIER_JWT_SECRET=your_supplier_jwt_secret
SUPPLIER_JWT_EXPIRY=7d
SUPPLIER_MAX_UPLOAD_SIZE=50MB
SUPPLIER_ALLOWED_FILE_TYPES=csv,xlsx,xls

# Default Limits
SUPPLIER_DEFAULT_MAX_TABLES=10
SUPPLIER_DEFAULT_MAX_RECORDS=100000
SUPPLIER_DEFAULT_MAX_EXPORTS=50
SUPPLIER_DEFAULT_MAX_API_CALLS=1000

# SFTP Export Scheduler
SUPPLIER_EXPORT_CRON=0 0 * * *  # Daily at midnight

# FTP Server Configuration
FTP_HOST=0.0.0.0
FTP_PORT=2121
FTP_PUBLIC_HOST=ftp.yourserver.com
FTP_PASV_MIN=10000
FTP_PASV_MAX=10100
FTP_BASE_DIR=./ftp-uploads
FTP_TLS=false
# FTP_TLS_KEY=/path/to/key.pem
# FTP_TLS_CERT=/path/to/cert.pem
```

### Default Quotas
| Setting | Default | Description |
|---------|---------|-------------|
| Max Tables | 10 | Tables per supplier |
| Max Records | 100,000 | Records per table |
| Max Exports/Month | 50 | Export operations |
| Max API Calls/Day | 1,000 | API requests |

---

## Account Creation (Admin Only)

**Note**: Supplier self-registration is disabled. All supplier accounts must be created by administrators.

### Creating a Supplier Account

1. **Admin navigates to**: Admin Panel → Suppliers → Create New
2. **Fill in required information**:
   - Company Name
   - Contact Name  
   - Email Address
   - (Optional) Company Code, Address, Phone, Tax ID
3. **Configure account settings**:
   - Tier Level (Basic, Standard, Premium, Enterprise)
   - Resource Limits (tables, records, storage)
4. **Optional: Enable FTP Access**:
   - Toggle "Enable FTP access"
   - System generates FTP credentials automatically
5. **Submit** the form

### Generated Credentials

When a supplier is created:
- A **temporary password** is generated (12 characters)
- The supplier must **change password on first login**
- If FTP is enabled, **FTP credentials** are also generated

### Sharing Credentials

The admin sees a modal with all credentials after creation:
- Login email
- Temporary password
- FTP username (if enabled)
- FTP password (if enabled)

**Important**: Credentials are shown only once. Admin must save and securely share them with the supplier.

---

## FTP Server Integration

### Overview

The Supplier FTP Server allows suppliers to upload data files directly via FTP protocol. This is useful for:
- Automated data uploads from legacy systems
- Bulk data transfers
- Integration with third-party inventory management systems

### FTP Server Architecture

```
                                   ┌─────────────────────────┐
                                   │    FTP Client           │
                                   │  (Supplier System)      │
                                   └───────────┬─────────────┘
                                               │
                                               │ FTP Protocol
                                               │ (Port 2121)
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PARTSFORM FTP Server                         │
│                    (supplierFtpService.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  • Authentication against supplier FTP credentials              │
│  • Virtual directory per supplier (/suppliers/{company_code})   │
│  • File upload handling and processing                          │
│  • Auto-import to target tables (optional)                      │
│  • Audit logging of all operations                              │
└───────────┬─────────────────────────────────────────────────────┘
            │
            │ Store files
            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   ftp-uploads/          │     │    MongoDB              │
│   └── {companyCode}/    │     │    • AuditLog           │
│       └── uploaded      │     │    • DataRecord (auto)  │
│           files...      │     │    • Supplier           │
└─────────────────────────┘     └─────────────────────────┘
```

### Managing FTP Access

#### Admin: FTP Settings Page (`/admin/suppliers/ftp-settings`)

- View all suppliers with FTP access status
- Enable/disable FTP for individual suppliers
- Regenerate FTP passwords
- View last access timestamps
- Monitor FTP server status

#### Actions Available:

| Action | Description |
|--------|-------------|
| Enable FTP | Generate new FTP credentials for supplier |
| Disable FTP | Revoke FTP access (credentials become invalid) |
| Regenerate | Create new password (invalidates old one) |

### FTP Credentials Structure

```javascript
ftpAccess: {
  enabled: Boolean,        // FTP access toggle
  username: String,        // e.g., "supplier_acme123"
  password: String,        // SHA-256 hashed
  directory: String,       // e.g., "/suppliers/ACME123"
  lastAccess: Date,        // Last FTP login timestamp
  createdAt: Date          // When credentials were generated
}
```

### FTP Connection Example

Suppliers connect using standard FTP clients:

```
Host: ftp.yourserver.com (from FTP_PUBLIC_HOST)
Port: 2121 (from FTP_PORT)
Username: supplier_acme123 (from ftpAccess.username)
Password: [provided at creation] (stored hashed)
```

### Auto-Import Feature

If a DataTable has FTP auto-import enabled:
- Uploaded files matching the configured pattern are automatically imported
- Records are added to the target table
- Import results are logged in audit

### Starting the FTP Server

The FTP server can be started in `app.js`:

```javascript
const ftpService = require('./services/supplierFtpService');

// Start FTP server (optional)
if (process.env.ENABLE_FTP_SERVER === 'true') {
  ftpService.start()
    .then(() => console.log('FTP server started'))
    .catch(err => console.error('FTP server failed:', err));
}
```

---

## First Login Flow

### Password Change Requirement

1. Supplier receives credentials from admin
2. Logs in at `/supplier/login`
3. System detects `mustChangePassword: true`
4. Redirects to password change form
5. Supplier sets new secure password
6. On success, logged in and redirected to dashboard

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

---

## Getting Started

### For Suppliers
1. **Receive credentials from admin** (email + temporary password)
2. **Login at** `/supplier/login`
3. **Change temporary password** on first login
4. **Access dashboard** and start managing data
5. Create tables, import data, set up exports
6. (Optional) Use FTP credentials for automated uploads

### For Admins
1. **Create supplier accounts** at Admin Panel → Suppliers → Create New
2. **Share credentials** securely with suppliers
3. **Monitor activity** in supplier details page
4. **Manage FTP access** at Admin Panel → Suppliers → FTP Settings
5. **Adjust quotas** as needed

---

## Support

For technical support or feature requests, contact the development team or create an issue in the project repository.

---

*Last Updated: February 2026*
