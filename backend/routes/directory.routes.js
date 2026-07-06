const express = require('express');
const { protect } = require('../middleware/auth');
const odoo = require('../services/odoo.service');

const router = express.Router();
router.use(protect);

// GET /api/directory  — searchable employee list
router.get('/', async (req, res) => {
  try {
    const employees = await odoo.getEmployees();
    // Optional search filter (done server-side to avoid multiple Odoo calls)
    const search = req.query.search ? req.query.search.toLowerCase() : null;
    const filtered = search
      ? employees.filter(e =>
          e.name.toLowerCase().includes(search) ||
          (e.job_title && e.job_title.toLowerCase().includes(search)) ||
          (e.department_id && e.department_id[1] && e.department_id[1].toLowerCase().includes(search))
        )
      : employees;
    res.json({ employees: filtered });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch employee directory.', detail: err.message });
  }
});

// GET /api/directory/:odooId  — single employee profile
router.get('/:odooId', async (req, res) => {
  try {
    const employee = await odoo.getEmployeeById(parseInt(req.params.odooId));
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    res.json({ employee });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch employee.', detail: err.message });
  }
});

module.exports = router;
