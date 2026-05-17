import re

with open('tenoweb.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Detect line ending
lf = '\r\n' if '\r\n' in html else '\n'

# Map: unique emoji for each industry -> key
icon_map = {
    '\U0001f6d2': 'retail',        # 🛒
    '\U0001f522': 'operations',    # 🔢
    '\U0001f393': 'edtech',        # 🎓
    '\U0001f4bc': 'finance',       # 💼
    '\U0001f3ed': 'logistics',     # 🏭
    '\U0001f310': 'startups',      # 🌐
}

# Cards that already have onclick (from previous partial edit)
already_done = {
    '\U0001f527': 'servicectr',    # 🔧
    '\U0001f680': 'sales',         # 🚀
}

changes = 0
for icon, key in icon_map.items():
    old_div = f'class="industry-card reveal">{lf}          <span class="industry-icon">{icon}'
    new_div = f'class="industry-card reveal" onclick="openIndustryModal(\'{key}\')">{lf}          <span class="industry-icon">{icon}'
    if old_div in html:
        html = html.replace(old_div, new_div, 1)
        changes += 1
        print(f'  Fixed: {key}')
    else:
        print(f'  ALREADY done or not found: {key}')

print(f'Total changes: {changes}')

# Add "Click to explore" cta hint to cards missing it
# Each card's last <li> text is unique — add cta before </ul> close
last_li_map = {
    'Customer trend insights': 'retail',
    'Workflow efficiency insights': 'operations',
    'Revenue forecasting': 'edtech',
    'Business reporting': 'finance',
    'Demand forecasting': 'logistics',
    'Cohort &amp; retention analysis': 'startups',
    'Technician performance KPIs': 'servicectr',
    'Lead source attribution': 'sales',
}

for li_text, key in last_li_map.items():
    # Check if cta already present near this li
    pattern = f'<li>{li_text}</li>'
    idx = html.find(pattern)
    if idx == -1:
        print(f'  li NOT found: {li_text}')
        continue
    # Check if cta already added
    snippet = html[idx:idx+200]
    if 'industry-card-cta' in snippet:
        print(f'  cta already present: {key}')
        continue
    old_block = f'<li>{li_text}</li>{lf}          </ul>{lf}        </div>'
    new_block = f'<li>{li_text}</li>{lf}          </ul>{lf}          <div class="industry-card-cta">Click to explore \u2192</div>{lf}        </div>'
    if old_block in html:
        html = html.replace(old_block, new_block, 1)
        print(f'  Added cta: {key}')
    else:
        print(f'  cta block not matched for: {key}')

# Inject modal + CSS + JS before CASE STUDIES anchor
ANCHOR = '  <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 CASE STUDIES \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->'
MODAL = r"""
  <!-- INDUSTRY DETAIL MODAL -->
  <div class="ind-modal-overlay" id="indModal" onclick="closeIndustryModal(event)">
    <div class="ind-modal-box">
      <button class="ind-modal-close" onclick="closeIndustryModal(null,true)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="ind-modal-header">
        <div class="ind-modal-icon" id="imIcon"></div>
        <div>
          <div class="ind-modal-name" id="imName"></div>
          <div class="ind-modal-subtitle" id="imSubtitle"></div>
        </div>
      </div>
      <div class="ind-modal-section-title">What We Improve</div>
      <div class="ind-modal-improvements" id="imImprovements"></div>
      <div class="ind-modal-divider"></div>
      <div class="ind-modal-section-title">Business Impact</div>
      <div class="ind-modal-impact" id="imImpact"></div>
      <a href="#consult" class="ind-modal-cta" onclick="closeIndustryModal(null,true)">Get Analytics for My Business &rarr;</a>
    </div>
  </div>
  <style>
  .industry-card{cursor:pointer;transition:all 0.25s}
  .industry-card-cta{font-size:0.72rem;font-weight:700;color:#0ea5e9;opacity:0;margin-top:0.7rem;transition:opacity 0.2s;letter-spacing:0.02em}
  .industry-card:hover .industry-card-cta{opacity:1}
  .industry-card:hover{border-color:rgba(14,165,233,0.5)!important;transform:translateY(-6px)!important}
  .ind-modal-overlay{display:none;position:fixed;inset:0;background:rgba(8,12,22,0.88);z-index:3100;align-items:center;justify-content:center;backdrop-filter:blur(14px)}
  .ind-modal-overlay.open{display:flex}
  .ind-modal-box{background:#fff;border-radius:24px;width:92vw;max-width:640px;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 50px 100px rgba(0,0,0,0.4);animation:indSlide 0.32s cubic-bezier(0.175,0.885,0.32,1.275)}
  @keyframes indSlide{from{opacity:0;transform:scale(0.88) translateY(30px)}to{opacity:1;transform:scale(1) translateY(0)}}
  .ind-modal-close{position:absolute;top:1rem;right:1rem;z-index:2;background:rgba(255,255,255,0.15);border:none;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);transition:background 0.2s}
  .ind-modal-close:hover{background:rgba(239,68,68,0.5)}
  .ind-modal-header{display:flex;align-items:center;gap:1rem;padding:2rem 2rem 1.5rem;background:linear-gradient(135deg,#0a0e17,#111827);border-radius:24px 24px 0 0}
  .ind-modal-icon{font-size:3rem;line-height:1;flex-shrink:0}
  .ind-modal-name{font-size:1.3rem;font-weight:800;color:white;letter-spacing:-0.03em;line-height:1.2}
  .ind-modal-subtitle{font-size:0.8rem;color:rgba(255,255,255,0.4);margin-top:0.3rem}
  .ind-modal-divider{height:1px;background:#e5e7eb;margin:0 2rem}
  .ind-modal-section-title{font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;padding:1.1rem 2rem 0.6rem}
  .ind-modal-improvements{display:flex;flex-direction:column;padding:0 2rem 0.5rem}
  .ind-improvement-item{display:flex;gap:0.9rem;align-items:flex-start;padding:0.85rem 0;border-bottom:1px solid #f3f4f6}
  .ind-improvement-item:last-child{border-bottom:none}
  .ind-improvement-icon{width:38px;height:38px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,rgba(26,86,219,0.09),rgba(14,165,233,0.09));border:1px solid rgba(26,86,219,0.12);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
  .ind-improvement-name{font-size:0.88rem;font-weight:700;color:#111827;margin-bottom:0.15rem}
  .ind-improvement-desc{font-size:0.79rem;color:#6b7280;line-height:1.65}
  .ind-modal-impact{display:flex;flex-wrap:wrap;gap:0.5rem;padding:0.3rem 2rem 1rem}
  .ind-impact-item{display:flex;align-items:center;gap:0.4rem;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:0.35rem 0.85rem;font-size:0.78rem;font-weight:600;color:#059669}
  .ind-impact-item::before{content:"\2714"}
  .ind-modal-cta{display:block;margin:0.3rem 2rem 2rem;text-align:center;text-decoration:none;background:linear-gradient(135deg,#1a56db,#0ea5e9);color:white;font-weight:700;font-size:0.95rem;padding:1rem;border-radius:14px;box-shadow:0 8px 24px rgba(26,86,219,0.28);transition:transform 0.2s,box-shadow 0.2s}
  .ind-modal-cta:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(26,86,219,0.4)}
  @media(max-width:600px){.ind-modal-header,.ind-modal-improvements,.ind-modal-impact,.ind-modal-section-title{padding-left:1.2rem;padding-right:1.2rem}.ind-modal-cta,.ind-modal-divider{margin-left:1.2rem;margin-right:1.2rem}}
  </style>
  <script>
  var industryData={
    retail:{icon:"🛒",name:"Retail & E-commerce",subtitle:"How We Help Retail Businesses Grow",improvements:[{icon:"📊",name:"Performance Monitoring",desc:"Track daily, weekly, and monthly sales performance across products, stores, and teams to identify what is driving revenue."},{icon:"📦",name:"Inventory Visibility",desc:"Monitor stock levels in real time to avoid overstocking, stockouts, and dead inventory."},{icon:"💰",name:"Revenue Analytics",desc:"Understand which products, categories, and seasons generate the highest profit."},{icon:"👥",name:"Customer Trend Insights",desc:"Analyze customer buying behavior, repeat purchases, preferences, and shopping trends to improve targeting."}],impact:["Better stock planning","Higher sales conversion","Reduced inventory losses","Smarter business decisions"]},
    operations:{icon:"🔢",name:"Operations & Service Businesses",subtitle:"Improve Operational Efficiency with Data",improvements:[{icon:"⚙️",name:"Process Monitoring",desc:"Track workflows from start to finish and identify delays or inefficiencies."},{icon:"📈",name:"Service Performance Analytics",desc:"Measure service quality, response times, completion rates, and SLA performance."},{icon:"📋",name:"Operational Reporting",desc:"Automate management reports for better decision-making."},{icon:"⚡",name:"Workflow Efficiency Insights",desc:"Identify repetitive bottlenecks and opportunities for automation."}],impact:["Faster operations","Better team productivity","Reduced manual reporting","Improved customer satisfaction"]},
    servicectr:{icon:"🔧",name:"Service Centers",subtitle:"Smarter Analytics for Repair & Service Centers",improvements:[{icon:"📊",name:"Complaint Trend Analysis",desc:"Identify common issues, product defects, and recurring customer complaints."},{icon:"⏱️",name:"Repair Turnaround Insights",desc:"Track average repair time and identify service delays."},{icon:"🔍",name:"Customer Issue Analytics",desc:"Understand root causes behind service requests and recurring failures."},{icon:"👷",name:"Technician Performance KPIs",desc:"Measure technician productivity, repair success rates, and workload distribution."}],impact:["Faster service completion","Improved technician performance","Better customer experience","Reduced repeat issues"]},
    edtech:{icon:"🎓",name:"EdTech & Education",subtitle:"Data Intelligence for Education Businesses",improvements:[{icon:"🎯",name:"Student Funnel Analytics",desc:"Track student journey from inquiry to enrollment."},{icon:"📉",name:"Lead-to-Enrollment Tracking",desc:"Measure marketing campaign effectiveness and conversion rates."},{icon:"🤖",name:"CRM Reporting Automation",desc:"Automate lead management, counselor tracking, and admission performance reports."},{icon:"📈",name:"Revenue Forecasting",desc:"Predict enrollment-based revenue trends for better planning."}],impact:["Higher student conversions","Better admission team performance","Improved marketing ROI","Smarter revenue planning"]},
    finance:{icon:"💼",name:"Finance & SMEs",subtitle:"Business Intelligence for Finance Teams & SMEs",improvements:[{icon:"💵",name:"Revenue Dashboards",desc:"Monitor income trends, branch performance, and business growth."},{icon:"✂️",name:"Cost Analytics",desc:"Identify unnecessary spending and optimize operating costs."},{icon:"📈",name:"Financial Performance Analytics",desc:"Track profitability, margins, collections, and business health."},{icon:"📝",name:"Business Reporting",desc:"Automate monthly and executive-level reports."}],impact:["Better profitability control","Smarter budgeting","Faster reporting","Improved financial decision-making"]},
    sales:{icon:"🚀",name:"Sales Companies",subtitle:"Sales Analytics That Drive Growth",improvements:[{icon:"🛤️",name:"Pipeline Analytics",desc:"Track deal stages, opportunities, and conversion bottlenecks."},{icon:"🎯",name:"Target vs Achievement",desc:"Monitor team and individual sales performance against goals."},{icon:"📊",name:"Team Performance Dashboards",desc:"Measure productivity, conversion rates, and sales effectiveness."},{icon:"🔎",name:"Lead Source Attribution",desc:"Understand which channels generate the highest quality leads."}],impact:["Higher conversions","Better sales accountability","Improved forecasting","Smarter lead investment"]},
    logistics:{icon:"🏭",name:"Logistics & Distribution",subtitle:"Analytics for Supply Chain & Distribution Growth",improvements:[{icon:"📦",name:"Inventory Trend Analytics",desc:"Monitor stock movement across warehouses and locations."},{icon:"🤝",name:"Dealer Performance Tracking",desc:"Measure distributor/dealer sales and operational efficiency."},{icon:"🚦",name:"Supply Chain Visibility",desc:"Track movement delays, stock risks, and fulfillment performance."},{icon:"🔮",name:"Demand Forecasting",desc:"Predict future demand using historical trends."}],impact:["Reduced stock shortages","Better distribution planning","Faster deliveries","Improved supply chain efficiency"]},
    startups:{icon:"🌐",name:"Startups & Growth Businesses",subtitle:"Scalable Analytics for Fast-Growing Businesses",improvements:[{icon:"📈",name:"Growth Metric Dashboards",desc:"Track acquisition, retention, churn, and expansion growth."},{icon:"📄",name:"Investor-Ready Reporting",desc:"Create clear business performance dashboards for stakeholders."},{icon:"🧠",name:"Unit Economics Analytics",desc:"Measure CAC, LTV, margins, and profitability."},{icon:"🔄",name:"Cohort & Retention Analysis",desc:"Understand customer behavior over time."}],impact:["Better investor confidence","Faster strategic decisions","Clear growth visibility","Stronger scalability planning"]}
  };
  function openIndustryModal(key){
    var d=industryData[key];if(!d)return;
    document.getElementById("imIcon").textContent=d.icon;
    document.getElementById("imName").textContent=d.name;
    document.getElementById("imSubtitle").textContent=d.subtitle;
    document.getElementById("imImprovements").innerHTML=d.improvements.map(function(i){
      return '<div class="ind-improvement-item"><div class="ind-improvement-icon">'+i.icon+'</div><div><div class="ind-improvement-name">'+i.name+'</div><div class="ind-improvement-desc">'+i.desc+'</div></div></div>';
    }).join("");
    document.getElementById("imImpact").innerHTML=d.impact.map(function(i){
      return '<div class="ind-impact-item">'+i+'</div>';
    }).join("");
    document.getElementById("indModal").classList.add("open");
    document.body.style.overflow="hidden";
  }
  function closeIndustryModal(event,force){
    if(!force&&event&&event.target!==document.getElementById("indModal"))return;
    document.getElementById("indModal").classList.remove("open");
    document.body.style.overflow="";
  }
  </script>

"""

if ANCHOR in html:
    # Remove any previously injected block first
    if '<!-- INDUSTRY DETAIL MODAL -->' in html:
        # remove old block
        start = html.find('  <!-- INDUSTRY DETAIL MODAL -->')
        end = html.find(ANCHOR, start)
        html = html[:start] + html[end:]
        print('Removed old modal block')
    html = html.replace(ANCHOR, MODAL + '  ' + ANCHOR.strip(), 1)
    print('Modal inserted')
else:
    print('ANCHOR NOT FOUND — searching...')
    idx = html.find('CASE STUDIES')
    print(f'  CASE STUDIES at index: {idx}')
    print(repr(html[idx-50:idx+50]))

with open('tenoweb.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done. onclick count:', sum(1 for line in html.split('\n') if 'openIndustryModal' in line))
