/**
 * DATA CLEANING ENGINE — Teno Analytics RFM Tool
 * Reads Excel/CSV, auto-detects columns, cleans data, returns structured JSON.
 */

const DataCleaner = {

  // ─── Column name mappings ───
  CUSTOMER_ID_NAMES: ['phone','mobile','contact_number','customer_phone','whatsapp','customer_id','client_id','email','contact','cust_id','customer','client','phone_number','mob','cell','telephone','cust_phone','customer_contact','mobile_number','id'],
  DATE_NAMES: ['invoice_date','order_date','purchase_date','transaction_date','bill_date','sale_date','date','txn_date','billing_date','inv_date','order_dt','trans_date','created_at','created_date','entry_date'],
  AMOUNT_NAMES: ['amount','order_value','sale_value','revenue','net_amount','total','invoice_total','grand_total','price','bill_amount','sales','value','total_amount','net_total','bill_value','total_sale','sale_amount','gross_amount','payment','paid_amount'],
  NAME_NAMES: ['customer_name','name','client_name','cust_name','buyer_name','full_name','party_name','party','buyer','consumer_name'],
  INVOICE_NAMES: ['invoice_number','invoice_no','inv_no','bill_no','bill_number','receipt_no','order_no','order_id','transaction_id','txn_id','voucher_no'],
  BRANCH_NAMES: ['branch','store','location','outlet','shop','branch_name','store_name','center','centre'],
  PRODUCT_NAMES: ['product','product_name','item','item_name','sku','category','product_category','service','description'],
  CITY_NAMES: ['city','town','area','region','state','district','zone'],

  /**
   * Read file (xlsx/csv) using SheetJS, return array of objects
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject('No file selected.');
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['xlsx','xls','csv'].includes(ext)) return reject('Unsupported file type. Please upload .xlsx, .xls, or .csv');
      const reader = new FileReader();
      reader.onerror = () => reject('Could not read file. It may be corrupted.');
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type:'array', cellDates:true, dateNF:'yyyy-mm-dd' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval:'' });
          if (!rows.length) return reject('File is empty — no data rows found.');
          resolve(rows);
        } catch(err) {
          reject('Failed to parse file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Normalize a header string for matching
   */
  _norm(s) {
    return String(s).toLowerCase().trim().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'');
  },

  /**
   * Find best matching column from headers
   */
  _findCol(headers, candidates) {
    const normHeaders = headers.map(h => this._norm(h));
    for (const c of candidates) {
      const idx = normHeaders.indexOf(this._norm(c));
      if (idx !== -1) return headers[idx];
    }
    // Fuzzy: check if any header contains a candidate substring
    for (const c of candidates) {
      const cn = this._norm(c);
      for (let i = 0; i < normHeaders.length; i++) {
        if (normHeaders[i].includes(cn) || cn.includes(normHeaders[i])) return headers[i];
      }
    }
    return null;
  },

  /**
   * Auto-detect columns from raw data headers
   */
  detectColumns(rows) {
    const headers = Object.keys(rows[0]);
    const map = {
      customer_id: this._findCol(headers, this.CUSTOMER_ID_NAMES),
      date:        this._findCol(headers, this.DATE_NAMES),
      amount:      this._findCol(headers, this.AMOUNT_NAMES),
      name:        this._findCol(headers, this.NAME_NAMES),
      invoice:     this._findCol(headers, this.INVOICE_NAMES),
      branch:      this._findCol(headers, this.BRANCH_NAMES),
      product:     this._findCol(headers, this.PRODUCT_NAMES),
      city:        this._findCol(headers, this.CITY_NAMES),
    };
    const missing = [];
    if (!map.customer_id) missing.push('Customer identifier (phone/email/ID)');
    if (!map.date) missing.push('Date column (invoice_date/order_date)');
    if (!map.amount) missing.push('Amount column (amount/total/revenue)');
    return { map, missing, headers };
  },

  /**
   * Parse a date value from various formats
   */
  _parseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) return val;
    const s = String(val).trim();
    if (!s) return null;
    // Try native parse first
    let d = new Date(s);
    if (!isNaN(d) && d.getFullYear() > 1990 && d.getFullYear() < 2100) return d;
    // DD-MM-YYYY or DD/MM/YYYY
    let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (m) {
      d = new Date(+m[3], +m[2]-1, +m[1]);
      if (!isNaN(d)) return d;
    }
    // YYYY-MM-DD
    m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (m) {
      d = new Date(+m[1], +m[2]-1, +m[3]);
      if (!isNaN(d)) return d;
    }
    // Excel serial number
    const num = parseFloat(s);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      d = new Date((num - 25569) * 86400000);
      if (!isNaN(d)) return d;
    }
    return null;
  },

  /**
   * Parse monetary value
   */
  _parseAmount(val) {
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    s = s.replace(/[₹$€£¥,\s]/g, '');
    s = s.replace(/^\((.+)\)$/, '-$1'); // (100) = -100
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  },

  /**
   * Clean phone/ID
   */
  _cleanId(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    s = s.replace(/[\s\-\(\)\.]/g, '');
    if (!s || s === '0' || s === 'null' || s === 'undefined' || s === 'NaN') return '';
    return s;
  },

  /**
   * Full cleaning pipeline
   */
  cleanData(rows, colMap) {
    const stats = { totalRows: rows.length, cleaned: 0, invalidDate: 0, invalidAmount: 0, emptyId: 0, duplicates: 0 };
    const seen = new Set();
    const cleaned = [];

    for (const row of rows) {
      // Customer ID
      const rawId = row[colMap.customer_id];
      const custId = this._cleanId(rawId);
      if (!custId) { stats.emptyId++; continue; }

      // Date
      const rawDate = row[colMap.date];
      const date = this._parseDate(rawDate);
      if (!date) { stats.invalidDate++; continue; }

      // Amount
      const rawAmt = row[colMap.amount];
      const amount = this._parseAmount(rawAmt);
      if (amount === null || amount <= 0) { stats.invalidAmount++; continue; }

      // Dedup key
      const invoiceNo = colMap.invoice ? String(row[colMap.invoice] || '').trim() : '';
      const dedupKey = invoiceNo
        ? invoiceNo
        : `${custId}_${date.toISOString().slice(0,10)}_${amount}`;
      if (seen.has(dedupKey)) { stats.duplicates++; continue; }
      seen.add(dedupKey);

      // Build clean record
      const record = {
        customer_id: custId,
        customer_name: colMap.name ? String(row[colMap.name] || '').trim() : '',
        invoice_date: date,
        amount: amount,
        invoice_number: invoiceNo,
        branch: colMap.branch ? String(row[colMap.branch] || '').trim() : '',
        product: colMap.product ? String(row[colMap.product] || '').trim() : '',
        city: colMap.city ? String(row[colMap.city] || '').trim() : '',
      };
      cleaned.push(record);
    }

    stats.cleaned = cleaned.length;
    return { data: cleaned, stats };
  },

  /**
   * Validate row count for free trial
   */
  validateRowCount(rows) {
    if (rows.length > 5000) {
      return { ok: false, msg: `Free trial supports up to 5,000 rows. Your file has ${rows.length.toLocaleString()} rows. Please contact us for unlimited analysis.` };
    }
    return { ok: true };
  }
};
