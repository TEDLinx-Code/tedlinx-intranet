const axios = require('axios');

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

let sessionId = null;
let sessionExpiry = null;

// Authenticate with Odoo and cache session
async function authenticate() {
  if (sessionId && sessionExpiry && Date.now() < sessionExpiry) {
    return sessionId;
  }
  const response = await axios.post(
    `${ODOO_URL}/web/session/authenticate`,
    {
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
    },
    { withCredentials: true }
  );
  if (response.data.error) {
    throw new Error(`Odoo auth failed: ${response.data.error.message}`);
  }
  // Extract session cookie
  const cookies = response.headers['set-cookie'];
  sessionId = cookies ? cookies.find(c => c.startsWith('session_id')).split(';')[0] : null;
  sessionExpiry = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
  return sessionId;
}

// Generic Odoo RPC call with automatic re-authentication on session expiry
async function rpc(model, method, args = [], kwargs = {}) {
  const cookie = await authenticate();
  const response = await axios.post(
    `${ODOO_URL}/web/dataset/call_kw`,
    {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs: { context: { lang: 'en_US' }, ...kwargs },
      },
    },
    { headers: { Cookie: cookie } }
  );

  // Detect session expiry — Odoo returns error code 100 or 'Session Expired'
  if (response.data.error) {
    const errMsg = JSON.stringify(response.data.error);
    const isSessionExpired =
      response.data.error.code === 100 ||
      errMsg.includes('Session Expired') ||
      errMsg.includes('session') ||
      errMsg.includes('AccessDenied');

    if (isSessionExpired) {
      // Force re-authentication and retry once
      console.log('[Odoo] Session expired — re-authenticating...');
      sessionId = null;
      sessionExpiry = null;
      const freshCookie = await authenticate();
      const retryResponse = await axios.post(
        `${ODOO_URL}/web/dataset/call_kw`,
        {
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model,
            method,
            args,
            kwargs: { context: { lang: 'en_US' }, ...kwargs },
          },
        },
        { headers: { Cookie: freshCookie } }
      );
      if (retryResponse.data.error) {
        throw new Error(`Odoo RPC error: ${JSON.stringify(retryResponse.data.error)}`);
      }
      return retryResponse.data.result;
    }

    throw new Error(`Odoo RPC error: ${JSON.stringify(response.data.error)}`);
  }

  return response.data.result;
}
// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

async function getEmployees(fields = ['id', 'name', 'job_title', 'department_id', 'work_email', 'mobile_phone', 'work_location_id', 'image_128']) {
  return rpc('hr.employee', 'search_read', [[['active', '=', true]]], { fields });
}

async function getEmployeeById(odooId) {
  const result = await rpc('hr.employee', 'search_read',
    [[['id', '=', odooId]]],
    { fields: ['id', 'name', 'job_title', 'department_id', 'work_email', 'mobile_phone', 'work_location_id', 'image_128', 'parent_id'] }
  );
  return result[0] || null;
}

// ─── LEAVE ────────────────────────────────────────────────────────────────────

async function getLeaveTypes() {
  return rpc('hr.leave.type', 'search_read',
    [[['active', '=', true]]],
    { fields: ['id', 'name', 'requires_allocation', 'employee_requests', 'leave_validation_type', 'request_unit', 'color'], order: 'sequence asc' }
  );
}

async function getLeaveAllocation(employeeOdooId) {
  const types = await rpc(
    'hr.leave.type',
    'get_allocation_data_request',
    [],
    { context: { employee_id: employeeOdooId } }
  ).catch((e) => {
    console.log('[Odoo] get_allocation_data_request failed:', e.message);
    return null;
  });

  if (!types) {
    return rpc('hr.leave.allocation', 'search_read',
      [[['employee_id', '=', employeeOdooId], ['state', '=', 'validate']]],
      { fields: ['id', 'holiday_status_id', 'number_of_days', 'state', 'date_from', 'date_to'] }
    );
  }

  // Odoo 19 format: [name, dataObject, bool, leave_type_id]
  return types
    .filter(t => Array.isArray(t) && t[1] && typeof t[1] === 'object')
    .map(t => ({
      id: t[3],
      holiday_status_id: [t[3], t[0]],
      number_of_days: t[1].virtual_remaining_leaves,
      max_leaves: t[1].max_leaves,
      leaves_taken: t[1].leaves_taken,
      virtual_remaining_leaves: t[1].virtual_remaining_leaves,
    }));
}

async function getLeaveRequests(employeeOdooId) {
  return rpc('hr.leave', 'search_read',
    [[['employee_id', '=', employeeOdooId]]],
    {
      fields: ['id', 'holiday_status_id', 'date_from', 'date_to', 'number_of_days', 'state', 'name'],
      order: 'date_from desc',
      limit: 50,
    }
  );
}

async function createLeaveRequest({ employeeOdooId, leaveTypeId, dateFrom, dateTo, name }) {
  const id = await rpc('hr.leave', 'create', [{
    employee_id: employeeOdooId,
    holiday_status_id: leaveTypeId,
    date_from: `${dateFrom} 08:00:00`,
    date_to: `${dateTo} 17:00:00`,
    name: name || 'Leave request',
  }]);
  console.log('[Odoo] Leave created, ID:', id);

  // In Odoo 19, action_confirm no longer exists — the leave is already
  // in 'confirm' state after create. Wrap in try/catch for compatibility.
  try {
    await rpc('hr.leave', 'action_confirm', [[id]]);
    console.log('[Odoo] Leave confirmed');
  } catch (e) {
    console.log('[Odoo] action_confirm skipped (Odoo 19 — already confirmed on create)');
  }

  return id;
}

async function getTeamLeaveRequests(managerOdooId) {
  // Get all employees under this manager
  const employees = await rpc('hr.employee', 'search_read',
    [[['parent_id', '=', managerOdooId]]],
    { fields: ['id', 'name'] }
  );
  const empIds = employees.map(e => e.id);
  if (!empIds.length) return [];
  return rpc('hr.leave', 'search_read',
    [[['employee_id', 'in', empIds], ['state', 'in', ['confirm', 'validate1']]]],
    { fields: ['id', 'employee_id', 'holiday_status_id', 'date_from', 'date_to', 'number_of_days', 'state', 'name'], order: 'date_from asc' }
  );
}

// All currently-approved leave org-wide — used by the calendar leave-sync cron.
async function getAllApprovedLeaves() {
  return rpc('hr.leave', 'search_read',
    [[['state', '=', 'validate']]],
    { fields: ['id', 'employee_id', 'holiday_status_id', 'date_from', 'date_to', 'name'] }
  );
}

async function approveLeave(leaveId) {
  // Odoo 19 uses action_validate instead of action_approve in some configurations
  try {
    return await rpc('hr.leave', 'action_approve', [[leaveId]]);
  } catch (e) {
    if (e.message.includes('does not exist')) {
      return await rpc('hr.leave', 'action_validate', [[leaveId]]);
    }
    throw e;
  }
}

async function refuseLeave(leaveId, reason) {
  try {
    return await rpc('hr.leave', 'action_refuse', [[leaveId]]);
  } catch (e) {
    if (e.message.includes('does not exist')) {
      return await rpc('hr.leave', 'action_refuse_wizard', [[leaveId]]);
    }
    throw e;
  }
}
// ─── EXPENSES ─────────────────────────────────────────────────────────────────
// Odoo 19: hr.expense.sheet is removed. Everything is on hr.expense directly.
// States: draft → reported → approved → done / refused

async function getExpenseCategories() {
  return rpc('product.product', 'search_read',
    [[['can_be_expensed', '=', true]]],
    { fields: ['id', 'name', 'standard_price'] }
  );
}

async function getExpenses(employeeOdooId) {
  return rpc('hr.expense', 'search_read',
    [[['employee_id', '=', employeeOdooId]]],
    {
      fields: ['id', 'name', 'product_id', 'total_amount', 'price_unit', 'quantity', 'date', 'state', 'currency_id', 'payment_mode'],
      order: 'date desc',
      limit: 50,
    }
  );
}

async function createExpense({ employeeOdooId, name, productId, totalAmount, date, description }) {
  // In Odoo 19, just create the expense and action_submit it directly
  const id = await rpc('hr.expense', 'create', [{
    employee_id: employeeOdooId,
    name,
    product_id: productId,
    total_amount: totalAmount,
    price_unit: totalAmount,
    date,
    description: description || '',
    quantity: 1,
    payment_mode: 'own_account',
  }]);
  console.log('[Odoo] Expense created, ID:', id);

  // Submit for approval
  try {
    await rpc('hr.expense', 'action_submit', [[id]]);
    console.log('[Odoo] Expense submitted');
  } catch (e) {
    console.log('[Odoo] action_submit failed:', e.message);
    // Try alternative method name
    try {
      await rpc('hr.expense', 'action_submit_expenses', [[id]]);
      console.log('[Odoo] Expense submitted via action_submit_expenses');
    } catch (e2) {
      console.log('[Odoo] Could not submit expense, leaving in draft:', e2.message);
    }
  }

  return { expenseId: id };
}

async function getTeamExpenses(managerOdooId) {
  const employees = await rpc('hr.employee', 'search_read',
    [[['parent_id', '=', managerOdooId]]],
    { fields: ['id', 'name'] }
  );
  const empIds = employees.map(e => e.id);
  if (!empIds.length) return [];
  return rpc('hr.expense', 'search_read',
    [[['employee_id', 'in', empIds], ['state', '=', 'submitted']]],
    {
      fields: ['id', 'name', 'employee_id', 'total_amount', 'price_unit', 'date', 'state', 'currency_id'],
      order: 'date desc',
    }
  );
}

async function approveExpenseSheet(expenseId) {
  try {
    return await rpc('hr.expense', 'action_approve', [[expenseId]], {
      context: { allowed_company_ids: [1], validate_analytic: true }
    });
  } catch (e) {
    if (e.message.includes('approve.duplicate')) {
      throw new Error('This expense may be a duplicate. Please review and approve directly in Odoo.');
    }
    throw e;
  }
}
async function refuseExpenseSheet(expenseId, reason) {
  try {
    // Odoo 19 uses a wizard to refuse expenses
    const wizardId = await rpc('hr.expense.refuse.wizard', 'create',
      [{ reason: reason || 'Refused', expense_ids: [[4, expenseId]] }],
      { context: { active_id: expenseId, active_ids: [expenseId], active_model: 'hr.expense' } }
    );
    return await rpc('hr.expense.refuse.wizard', 'action_refuse',
      [[wizardId]],
      { context: { active_id: expenseId, active_ids: [expenseId], active_model: 'hr.expense' } }
    );
  } catch (e) {
    console.log('[Odoo] refuseExpenseSheet wizard failed:', e.message);
    throw e;
  }
}

// ─── PAYSLIPS ─────────────────────────────────────────────────────────────────

async function getPayslips(employeeOdooId) {
  return rpc('hr.payslip', 'search_read',
    [[['employee_id', '=', employeeOdooId], ['state', 'in', ['done', 'paid']]]],
    {
      fields: ['id', 'name', 'date_from', 'date_to', 'state', 'currency_id', 'paid', 'struct_id', 'payslip_run_id', 'line_ids'],
      order: 'date_from desc',
      limit: 24,
    }
  );
}

async function getPayslipLines(payslipId) {
  return rpc('hr.payslip.line', 'search_read',
    [[['slip_id', '=', payslipId]]],
    {
      fields: ['id', 'name', 'code', 'category_id', 'amount', 'total', 'sequence'],
      order: 'sequence asc',
    }
  );
}

async function getPayslipDownloadUrl(payslipId) {
  return `${ODOO_URL}/odoo/payroll/payslip/${payslipId}/print`;
}
// Odoo 19: folders and files are both `documents.document`.
// Folders have type='folder', files have type='binary' or 'url'.
// Parent-child relationship uses `folder_id` (many2one → documents.document).

const INTRANET_FOLDER_NAME = process.env.ODOO_INTRANET_FOLDER || 'Intranet';

let intranetFolderIdCache = null;
let intranetFolderIdsCache = null;

// Find the root "Intranet" folder ID
async function getIntranetFolderId() {
  if (intranetFolderIdCache) return intranetFolderIdCache;

  const results = await rpc('documents.document', 'search_read',
    [[['name', '=', INTRANET_FOLDER_NAME], ['type', '=', 'folder']]],
    { fields: ['id', 'name', 'folder_id'], limit: 1 }
  );

  if (!results.length) {
    throw new Error(
      `Odoo Documents folder "${INTRANET_FOLDER_NAME}" not found. ` +
      `Please create a folder named "${INTRANET_FOLDER_NAME}" in Odoo Documents, ` +
      `or set ODOO_INTRANET_FOLDER in your .env to match your folder name.`
    );
  }

  intranetFolderIdCache = results[0].id;
  console.log(`[Odoo] Intranet folder "${INTRANET_FOLDER_NAME}" resolved to ID ${intranetFolderIdCache}`);
  return intranetFolderIdCache;
}

// Get all subfolder IDs under the Intranet root (recursive, client-side)
async function getAllIntranetFolderIds() {
  if (intranetFolderIdsCache) return intranetFolderIdsCache;

  const rootId = await getIntranetFolderId();

  // Fetch all folders in one call
  const allFolders = await rpc('documents.document', 'search_read',
    [[['type', '=', 'folder'], ['folder_id', '!=', false]]],
    { fields: ['id', 'folder_id'] }
  );

  // Collect all descendants of rootId
  const collected = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of allFolders) {
      const parentId = Array.isArray(f.folder_id) ? f.folder_id[0] : f.folder_id;
      if (!collected.has(f.id) && collected.has(parentId)) {
        collected.add(f.id);
        changed = true;
      }
    }
  }

  intranetFolderIdsCache = [...collected];
  return intranetFolderIdsCache;
}

// Get Intranet root + its direct subfolders for the sidebar
async function getDocumentFolders() {
  const rootId = await getIntranetFolderId();

  const subfolders = await rpc('documents.document', 'search_read',
    [[['type', '=', 'folder'], ['folder_id', '=', rootId]]],
    { fields: ['id', 'name', 'folder_id'] }
  );

  return {
    root: { id: rootId, name: INTRANET_FOLDER_NAME },
    subfolders,
  };
}

// Fetch documents scoped to Intranet folder tree
async function getDocuments({ folderId = null, search = null } = {}) {
  const allFolderIds = await getAllIntranetFolderIds();

  // If a specific subfolder requested, verify it is within the Intranet tree
  const folderScope = folderId
    ? (allFolderIds.includes(parseInt(folderId)) ? [parseInt(folderId)] : allFolderIds)
    : allFolderIds;

  const domain = [
    ['type', 'in', ['binary', 'url']],
    ['folder_id', 'in', folderScope],
  ];
  if (search) domain.push(['name', 'ilike', search]);

  return rpc('documents.document', 'search_read',
    [domain],
    {
      fields: ['id', 'name', 'mimetype', 'file_size', 'create_date', 'write_date',
               'folder_id', 'type', 'url', 'tag_ids', 'access_token'],
      order: 'folder_id asc, write_date desc',
      limit: 200,
    }
  );
}

async function getDocumentDownloadUrl(documentId) {
  // Odoo 19 uses access_token-based URLs instead of /documents/content/{id}
  const results = await rpc('documents.document', 'search_read',
    [[['id', '=', documentId]]],
    { fields: ['id', 'access_token', 'type', 'url'] }
  );
  const doc = results[0];
  if (!doc) throw new Error('Document not found.');

  // URL-type documents (links) just redirect to their external URL
  if (doc.type === 'url' && doc.url) return doc.url;

  // Binary files use the access_token-based viewer/download path
  return `${ODOO_URL}/odoo/documents/${doc.access_token}`;
}

async function getDocumentTags() {
  const allFolderIds = await getAllIntranetFolderIds();
  const docs = await rpc('documents.document', 'search_read',
    [[['folder_id', 'in', allFolderIds], ['type', 'in', ['binary', 'url']]]],
    { fields: ['tag_ids'] }
  );
  const tagIds = [...new Set(docs.flatMap(d => d.tag_ids))];
  if (!tagIds.length) return [];
  return rpc('documents.tag', 'search_read',
    [[['id', 'in', tagIds]]],
    { fields: ['id', 'name'] }
  );
}


// Call this on server startup to validate the folder exists early
async function validateIntranetFolder() {
  // Clear caches so a restart always re-resolves the folder
  intranetFolderIdCache = null;
  intranetFolderIdsCache = null;
  try {
    await getIntranetFolderId();
  } catch (err) {
    console.warn(`[Odoo] WARNING: ${err.message}`);
  }
}

module.exports = {
  getEmployees,
  getEmployeeById,
  getLeaveTypes,
  getLeaveAllocation,
  getLeaveRequests,
  createLeaveRequest,
  getTeamLeaveRequests,
  getAllApprovedLeaves,
  approveLeave,
  refuseLeave,
  getExpenseCategories,
  getExpenses,
  createExpense,
  getTeamExpenses,
  approveExpenseSheet,
  refuseExpenseSheet,
  getDocumentFolders,
  getDocuments,
  getDocumentDownloadUrl,
  getDocumentTags,
  validateIntranetFolder,
  getPayslips,
  getPayslipLines,
  getPayslipDownloadUrl,
};