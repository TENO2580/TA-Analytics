/**
 * RFM CALCULATION ENGINE — Teno Analytics
 * Takes cleaned transaction data, calculates RFM scores, segments customers.
 */

const RFMEngine = {

  /**
   * Assign quantile-based score (1-5). Higher values get higher scores.
   * For Recency, LOWER days = HIGHER score (invert=true).
   */
  _quantileScore(values, invert) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const thresholds = [
      sorted[Math.floor(n * 0.2)] || 0,
      sorted[Math.floor(n * 0.4)] || 0,
      sorted[Math.floor(n * 0.6)] || 0,
      sorted[Math.floor(n * 0.8)] || 0,
    ];
    return values.map(v => {
      let score;
      if (v <= thresholds[0]) score = 1;
      else if (v <= thresholds[1]) score = 2;
      else if (v <= thresholds[2]) score = 3;
      else if (v <= thresholds[3]) score = 4;
      else score = 5;
      return invert ? (6 - score) : score;
    });
  },

  /**
   * Determine customer segment from R, F, M scores
   */
  _segment(r, f, m) {
    const avg = (r + f + m) / 3;
    if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
    if (f >= 4 && m >= 4) return 'Loyal Customers';
    if (r >= 4 && f >= 2 && f <= 3) return 'Potential Loyalists';
    if (r >= 4 && f <= 1) return 'New Customers';
    if (r === 3 && f >= 2 && m >= 2) return 'Need Attention';
    if (r <= 2 && f >= 3 && m >= 3) return 'At Risk';
    if (r <= 2 && f <= 2 && m <= 2) return 'Lost Customers';
    if (m >= 5) return 'Big Spenders';
    if (r <= 2 && f <= 2) return 'Inactive Customers';
    if (avg >= 3.5) return 'Loyal Customers';
    if (avg >= 2.5) return 'Need Attention';
    return 'Inactive Customers';
  },

  /**
   * Get segment CSS class key
   */
  segmentClass(seg) {
    const map = {
      'Champions': 'champions',
      'Loyal Customers': 'loyal',
      'Potential Loyalists': 'potential',
      'New Customers': 'new',
      'Need Attention': 'attention',
      'At Risk': 'atrisk',
      'Lost Customers': 'lost',
      'Big Spenders': 'bigspenders',
      'Inactive Customers': 'inactive',
    };
    return map[seg] || 'inactive';
  },

  /**
   * Get segment color
   */
  segmentColor(seg) {
    const map = {
      'Champions': '#10b981',
      'Loyal Customers': '#1a56db',
      'Potential Loyalists': '#6366f1',
      'New Customers': '#8b5cf6',
      'Need Attention': '#eab308',
      'At Risk': '#f97316',
      'Lost Customers': '#ef4444',
      'Big Spenders': '#d97706',
      'Inactive Customers': '#6b7280',
    };
    return map[seg] || '#6b7280';
  },

  /**
   * Main: calculate RFM from cleaned transaction array
   * @param {Array} transactions - cleaned records from DataCleaner
   * @returns {Object} { customers, segments, monthlyTrend, totalRevenue }
   */
  calculate(transactions) {
    const today = new Date();

    // ── Group by customer_id ──
    const groups = {};
    for (const tx of transactions) {
      const id = tx.customer_id;
      if (!groups[id]) {
        groups[id] = { customer_id: id, customer_name: tx.customer_name, transactions: [], branches: new Set(), products: new Set() };
      }
      groups[id].transactions.push(tx);
      if (tx.customer_name && !groups[id].customer_name) groups[id].customer_name = tx.customer_name;
      if (tx.branch) groups[id].branches.add(tx.branch);
      if (tx.product) groups[id].products.add(tx.product);
    }

    const customerIds = Object.keys(groups);
    const recencies = [];
    const frequencies = [];
    const monetaries = [];
    const customerList = [];

    for (const id of customerIds) {
      const g = groups[id];
      const dates = g.transactions.map(t => t.invoice_date).filter(Boolean);
      const amounts = g.transactions.map(t => t.amount).filter(a => a > 0);
      const lastDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const recency = Math.max(0, Math.floor((today - lastDate) / 86400000));
      const frequency = g.transactions.length;
      const monetary = amounts.reduce((s, a) => s + a, 0);

      recencies.push(recency);
      frequencies.push(frequency);
      monetaries.push(monetary);

      customerList.push({
        customer_id: id,
        customer_name: g.customer_name || '',
        last_purchase_date: lastDate,
        recency_days: recency,
        frequency: frequency,
        monetary: Math.round(monetary * 100) / 100,
        average_order_value: Math.round((monetary / frequency) * 100) / 100,
        branches: [...g.branches],
        products: [...g.products],
      });
    }

    // ── Score ──
    const rScores = this._quantileScore(recencies, true);   // lower recency = higher score
    const fScores = this._quantileScore(frequencies, false);
    const mScores = this._quantileScore(monetaries, false);

    for (let i = 0; i < customerList.length; i++) {
      customerList[i].r_score = rScores[i];
      customerList[i].f_score = fScores[i];
      customerList[i].m_score = mScores[i];
      customerList[i].rfm_score = `${rScores[i]}${fScores[i]}${mScores[i]}`;
      customerList[i].segment = this._segment(rScores[i], fScores[i], mScores[i]);
    }

    // ── Sort by monetary descending ──
    customerList.sort((a, b) => b.monetary - a.monetary);

    // ── Segment summary ──
    const segmentNames = ['Champions','Loyal Customers','Potential Loyalists','New Customers','Need Attention','At Risk','Lost Customers','Big Spenders','Inactive Customers'];
    const segments = {};
    for (const s of segmentNames) {
      const custs = customerList.filter(c => c.segment === s);
      segments[s] = {
        count: custs.length,
        pct: customerList.length ? Math.round(custs.length / customerList.length * 100) : 0,
        revenue: Math.round(custs.reduce((sum, c) => sum + c.monetary, 0)),
      };
    }

    // ── Monthly trend ──
    const monthMap = {};
    for (const tx of transactions) {
      if (!tx.invoice_date) continue;
      const key = tx.invoice_date.getFullYear() + '-' + String(tx.invoice_date.getMonth() + 1).padStart(2, '0');
      if (!monthMap[key]) monthMap[key] = { count: 0, revenue: 0 };
      monthMap[key].count++;
      monthMap[key].revenue += tx.amount;
    }
    const monthlyTrend = Object.keys(monthMap).sort().map(k => ({
      month: k, count: monthMap[k].count, revenue: Math.round(monthMap[k].revenue)
    }));

    // ── Totals ──
    const totalRevenue = Math.round(customerList.reduce((s, c) => s + c.monetary, 0));
    const repeatBuyers = customerList.filter(c => c.frequency > 1).length;

    return {
      customers: customerList,
      segments,
      monthlyTrend,
      totalRevenue,
      totalCustomers: customerList.length,
      repeatRate: customerList.length ? Math.round(repeatBuyers / customerList.length * 100) : 0,
      avgCustomerValue: customerList.length ? Math.round(totalRevenue / customerList.length) : 0,
    };
  },

  /**
   * Generate AI-style business insights from RFM results
   */
  generateInsights(result) {
    const ins = [];
    const { segments, totalCustomers, totalRevenue, repeatRate, avgCustomerValue, customers, monthlyTrend } = result;
    const fmt = n => '₹' + Number(n).toLocaleString('en-IN');

    // ── Revenue concentration ──
    if (segments['Champions'].count > 0) {
      const revPct = totalRevenue ? Math.round(segments['Champions'].revenue / totalRevenue * 100) : 0;
      ins.push({ icon: '🏆', cat: 'Revenue', priority: 'high',
        text: `Champions (${segments['Champions'].pct}% of customers) generate ${revPct}% of your total revenue. ${revPct > 40 ? 'This is a high concentration risk — diversify by nurturing Potential Loyalists.' : 'Good balance. Keep rewarding them.'}`,
        action: revPct > 40 ? 'Launch loyalty program for Potential Loyalists' : 'Continue VIP rewards for Champions' });
    }

    // ── Churn alert ──
    const churnCount = segments['At Risk'].count + segments['Lost Customers'].count + segments['Inactive Customers'].count;
    const churnPct = totalCustomers ? Math.round(churnCount / totalCustomers * 100) : 0;
    if (churnCount > 0) {
      const churnRev = segments['At Risk'].revenue + segments['Lost Customers'].revenue + segments['Inactive Customers'].revenue;
      ins.push({ icon: '🚨', cat: 'Churn Risk', priority: 'critical',
        text: `${churnCount} customers (${churnPct}%) are at risk of churning or already lost — representing ${fmt(churnRev)} in past revenue. Immediate action needed.`,
        action: 'Launch win-back campaign with personalized offers' });
    }

    // ── At Risk deep dive ──
    if (segments['At Risk'].count > 0) {
      const atRiskCusts = customers.filter(c => c.segment === 'At Risk');
      const avgDays = Math.round(atRiskCusts.reduce((s, c) => s + c.recency_days, 0) / atRiskCusts.length);
      ins.push({ icon: '⚠️', cat: 'Retention', priority: 'high',
        text: `${segments['At Risk'].count} At Risk customers haven't purchased in an average of ${avgDays} days. They were previously strong buyers with ${fmt(Math.round(segments['At Risk'].revenue / segments['At Risk'].count))} average lifetime value.`,
        action: 'Send re-engagement WhatsApp campaign within 48 hours' });
    }

    // ── Lost customers ──
    if (segments['Lost Customers'].count > 0) {
      const lostAvgSpend = Math.round(segments['Lost Customers'].revenue / segments['Lost Customers'].count);
      ins.push({ icon: '🔴', cat: 'Recovery', priority: 'medium',
        text: `${segments['Lost Customers'].count} Lost Customers with ${fmt(lostAvgSpend)} average past spend each. Total recoverable revenue: ${fmt(segments['Lost Customers'].revenue)}.`,
        action: 'Run win-back discount campaign (15-20% off)' });
    }

    // ── New customer conversion ──
    if (segments['New Customers'].count > 0) {
      const newPct = segments['New Customers'].pct;
      ins.push({ icon: '🟣', cat: 'Growth', priority: 'medium',
        text: `${segments['New Customers'].count} New Customers acquired (${newPct}%). ${newPct > 20 ? 'Strong acquisition — focus on converting them to repeat buyers.' : 'Acquisition is steady. Optimize your onboarding flow.'}`,
        action: 'Launch welcome series with first-repeat incentive' });
    }

    // ── Repeat rate analysis ──
    ins.push({ icon: '🔄', cat: 'Loyalty', priority: repeatRate > 50 ? 'positive' : 'high',
      text: `Repeat purchase rate: ${repeatRate}%. ${repeatRate > 60 ? 'Excellent customer stickiness!' : repeatRate > 40 ? 'Good retention. Push for loyalty programs to break 60%.' : 'Low repeat rate. Focus heavily on post-purchase engagement and follow-ups.'}`,
      action: repeatRate > 50 ? 'Maintain current retention strategy' : 'Implement loyalty points or subscription model' });

    // ── Top customer dependency ──
    if (customers.length >= 10) {
      const top10Rev = customers.slice(0, Math.ceil(customers.length * 0.1)).reduce((s, c) => s + c.monetary, 0);
      const top10Pct = Math.round(top10Rev / totalRevenue * 100);
      ins.push({ icon: '👑', cat: 'Risk', priority: top10Pct > 60 ? 'critical' : 'info',
        text: `Top 10% of customers contribute ${top10Pct}% of revenue. ${top10Pct > 60 ? 'Dangerously high dependency — losing a few top customers would severely impact business.' : 'Healthy distribution across your customer base.'}`,
        action: top10Pct > 60 ? 'Diversify revenue by growing mid-tier customers' : 'Continue balanced growth strategy' });
    }

    // ── Big spenders ──
    if (segments['Big Spenders'].count > 0) {
      ins.push({ icon: '💰', cat: 'Upsell', priority: 'medium',
        text: `${segments['Big Spenders'].count} Big Spenders identified with high monetary value but varying frequency. These are prime upsell and cross-sell targets.`,
        action: 'Create premium product bundles or VIP membership tier' });
    }

    // ── Potential loyalists ──
    if (segments['Potential Loyalists'].count > 0) {
      ins.push({ icon: '⭐', cat: 'Growth', priority: 'medium',
        text: `${segments['Potential Loyalists'].count} Potential Loyalists are recent buyers with moderate frequency. With the right nudge, they can become Champions.`,
        action: 'Send personalized product recommendations within 7 days' });
    }

    // ── Average customer value ──
    ins.push({ icon: '📊', cat: 'Revenue', priority: 'info',
      text: `Average customer lifetime value: ${fmt(avgCustomerValue)}. ${avgCustomerValue > 5000 ? 'Strong per-customer revenue.' : 'Consider strategies to increase average order value — bundles, upsells, or minimum order incentives.'}`,
      action: 'Implement cross-sell recommendations at checkout' });

    // ── Monthly trend insight ──
    if (monthlyTrend.length >= 2) {
      const last = monthlyTrend[monthlyTrend.length - 1];
      const prev = monthlyTrend[monthlyTrend.length - 2];
      const change = prev.revenue > 0 ? Math.round((last.revenue - prev.revenue) / prev.revenue * 100) : 0;
      ins.push({ icon: change >= 0 ? '📈' : '📉', cat: 'Trend', priority: change < -10 ? 'critical' : 'info',
        text: `Revenue ${change >= 0 ? 'grew' : 'declined'} ${Math.abs(change)}% from ${prev.month} to ${last.month} (${fmt(prev.revenue)} → ${fmt(last.revenue)}).${change < -10 ? ' Investigate the decline immediately.' : ''}`,
        action: change < -10 ? 'Analyze drop causes — check marketing, seasonality, churn' : 'Maintain current growth trajectory' });
    }

    // ── Purchase frequency insight ──
    if (customers.length > 0) {
      const avgFreq = Math.round(customers.reduce((s, c) => s + c.frequency, 0) / customers.length * 10) / 10;
      const medianRecency = customers.map(c => c.recency_days).sort((a, b) => a - b)[Math.floor(customers.length / 2)];
      ins.push({ icon: '🛒', cat: 'Behavior', priority: 'info',
        text: `Average purchase frequency: ${avgFreq} orders per customer. Median recency: ${medianRecency} days. ${medianRecency > 90 ? 'Most customers haven\'t purchased in 3+ months — increase touchpoints.' : 'Healthy purchase cadence.'}`,
        action: medianRecency > 90 ? 'Set up automated re-engagement at 60-day mark' : 'Maintain communication frequency' });
    }

    // ── Revenue recovery potential ──
    if (churnCount > 0) {
      const recoveryPotential = Math.round((segments['At Risk'].revenue * 0.3) + (segments['Lost Customers'].revenue * 0.1));
      if (recoveryPotential > 0) {
        ins.push({ icon: '💡', cat: 'Opportunity', priority: 'high',
          text: `Estimated recoverable revenue: ${fmt(recoveryPotential)} — if you re-engage 30% of At Risk and 10% of Lost customers through targeted campaigns.`,
          action: 'Build segment-specific recovery campaigns this week' });
      }
    }

    return ins;
  },

  /**
   * Get suggested action for at-risk / lost customers
   */
  suggestAction(segment, recencyDays) {
    if (segment === 'At Risk') {
      if (recencyDays < 60) return 'Send discount offer';
      if (recencyDays < 120) return 'WhatsApp campaign';
      return 'Call customer';
    }
    if (segment === 'Lost Customers') {
      if (recencyDays < 180) return 'Win-back discount';
      return 'Retention follow-up';
    }
    if (segment === 'Need Attention') return 'Send reminder';
    if (segment === 'Inactive Customers') return 'Re-engagement email';
    return '—';
  }
};
