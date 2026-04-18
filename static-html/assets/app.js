function navActive() {
  var path = location.pathname.split("/").pop() || "index.html";
  var links = document.querySelectorAll(".nav a");
  links.forEach(function (a) {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });
}

function bindTriageDemo() {
  var btn = document.getElementById("triageBtn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    var symptom = (document.getElementById("symptom").value || "").trim();
    if (symptom.length < 4) {
      alert("请至少输入4个字症状");
      return;
    }
    var dep = "中医内科";
    if (/腰|颈|肩|扭伤|关节/.test(symptom)) dep = "针灸推拿科";
    if (/月经|痛经|白带|妇科/.test(symptom)) dep = "中医妇科";
    if (/儿童|小儿|宝宝|夜啼/.test(symptom)) dep = "中医儿科";
    var result = document.getElementById("triageResult");
    result.innerHTML =
      "<p><strong>推荐科室：</strong>" + dep + "</p>" +
      "<p><strong>置信度：</strong>78%</p>" +
      "<p><strong>风险等级：</strong><span class='tag'>中</span></p>" +
      "<p><strong>建议：</strong>建议先到" + dep + "就诊，由医生面诊后进一步检查。</p>";
  });
}

function bindLoginDemo() {
  var form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    location.href = "index.html";
  });
}

navActive();
bindTriageDemo();
bindLoginDemo();
