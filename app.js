(() => {
  const TABLE = "exhibition_visitors";
  const FIELDS = [
    ["visitor_name", "نام"],
    ["company", "شرکت"],
    ["activity_service", "حوزه فعالیت / خدمات"],
    ["phone", "شماره تماس"],
    ["extra_notes", "توضیحات تکمیلی"]
  ];
  let supabaseClient, allRows = [], filteredRows = [], page = 1, sortField = "visitor_name", sortAsc = true;
  const $ = (id) => document.getElementById(id);
  const fa = (n) => Number(n || 0).toLocaleString("fa-IR");
  const norm = (v) => String(v ?? "").toLocaleLowerCase("fa").replace(/[ي]/g,"ی").replace(/[ك]/g,"ک").trim();

  function notify(msg) {
    const el = $("toast"); el.textContent = msg; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2600);
  }
  function setStatus(msg, ok=false) {
    $("connectionStatus").textContent = msg;
    document.querySelector(".live-dot").style.background = ok ? "#9fb56c" : "#d49b6b";
  }
  async function loadData() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY ||
        window.SUPABASE_URL.includes("YOUR-PROJECT") || window.SUPABASE_ANON_KEY.includes("YOUR_")) {
      setStatus("تنظیم Supabase کامل نیست");
      $("tableBody").innerHTML = '<tr><td colspan="5" class="empty">ابتدا آدرس پروژه و کلید عمومی Supabase را در فایل config.js وارد کنید.</td></tr>';
      return;
    }
    try {
      setStatus("در حال دریافت اطلاعات...");
      supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      let rows = [], from = 0, step = 1000;
      while (true) {
        const { data, error } = await supabaseClient.from(TABLE).select("*").order("id", {ascending:true}).range(from, from + step - 1);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < step) break;
        from += step;
      }
      allRows = rows;
      setStatus("اتصال برقرار است", true);
      renderStats(); renderChart(); applyFilters();
    } catch (e) {
      console.error(e); setStatus("خطا در دریافت اطلاعات");
      $("tableBody").innerHTML = `<tr><td colspan="5" class="empty">خطا: ${escapeHtml(e.message)}<br>تنظیمات SQL و دسترسی عمومی را بررسی کنید.</td></tr>`;
    }
  }
  function renderStats() {
    $("totalCount").textContent = fa(allRows.length);
    $("nameCount").textContent = fa(allRows.filter(r => r.visitor_name).length);
    $("companyCount").textContent = fa(new Set(allRows.map(r=>norm(r.company)).filter(Boolean)).size);
    $("phoneCount").textContent = fa(allRows.filter(r => r.phone).length);
  }
function renderChart() {
  const counts = {};

  allRows.forEach(r => {
    const v = norm(r.activity_service)
      .replace(/[\u200c\u200f\u200e]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (v) counts[v] = (counts[v] || 0) + 1;
  });

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const max = Math.max(1, ...top.map(x => x[1]));

  $("activityChart").innerHTML = top.length
    ? top.map(([name, n]) =>
      `<div class="bar-row">
        <div class="bar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${n/max*100}%"></div>
        </div>
        <div class="bar-value">${fa(n)}</div>
      </div>`
    ).join("")
    : '<div class="empty">داده‌ای برای نمایش وجود ندارد.</div>';
}
  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function applyFilters() {
    const global = norm($("globalSearch").value);
    const filters = {};
    document.querySelectorAll("[data-filter]").forEach(el => filters[el.dataset.filter] = norm(el.value));
    filteredRows = allRows.filter(r => {
      const globalMatch = !global || FIELDS.some(([key]) => norm(r[key]).includes(global));
      const columnMatch = FIELDS.every(([key]) => !filters[key] || norm(r[key]).includes(filters[key]));
      return globalMatch && columnMatch;
    });
    filteredRows.sort((a,b) => {
      const x=norm(a[sortField]), y=norm(b[sortField]);
      return (x<y?-1:x>y?1:0) * (sortAsc?1:-1);
    });
    page=1; renderTable();
  }
  function renderTable() {
    const size = Number($("pageSize").value), pages = Math.max(1,Math.ceil(filteredRows.length/size));
    page = Math.min(page,pages);
    const start=(page-1)*size, rows=filteredRows.slice(start,start+size);
    $("tableBody").innerHTML = rows.length ? rows.map(r => `<tr>${FIELDS.map(([key])=>`<td>${escapeHtml(r[key] || "—")}</td>`).join("")}</tr>`).join("") :
      '<tr><td colspan="5" class="empty">رکوردی با این فیلترها پیدا نشد.</td></tr>';
    $("resultSummary").textContent = `${fa(filteredRows.length)} رکورد از ${fa(allRows.length)} رکورد`;
    $("visibleCount").textContent = `${fa(rows.length)} ردیف در این صفحه`;
    $("pageInfo").textContent = `صفحه ${fa(page)} از ${fa(pages)}`;
    $("prevBtn").disabled=page<=1; $("nextBtn").disabled=page>=pages;
  }
  function exportCsv() {
    const headers=FIELDS.map(x=>x[1]);
    const keys=FIELDS.map(x=>x[0]);
    const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const csv=[headers.map(quote).join(","),...filteredRows.map(r=>keys.map(k=>quote(r[k])).join(","))].join("\r\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download="exhibition_visitors_filtered.csv"; a.click(); URL.revokeObjectURL(url);
  }
  $("globalSearch").addEventListener("input",applyFilters);
  document.querySelectorAll("[data-filter]").forEach(el=>el.addEventListener("input",applyFilters));
  $("pageSize").addEventListener("change",()=>{page=1;renderTable()});
  $("clearBtn").addEventListener("click",()=>{ $("globalSearch").value=""; document.querySelectorAll("[data-filter]").forEach(el=>el.value=""); applyFilters(); });
  $("exportBtn").addEventListener("click",exportCsv);
  $("refreshBtn").addEventListener("click",loadData);
  $("prevBtn").addEventListener("click",()=>{page--;renderTable()});
  $("nextBtn").addEventListener("click",()=>{page++;renderTable()});
  document.querySelectorAll("th[data-sort]").forEach(th=>th.addEventListener("click",()=>{
    const field=th.dataset.sort; if(sortField===field) sortAsc=!sortAsc; else {sortField=field;sortAsc=true;} applyFilters();
  }));
  loadData();
})();
