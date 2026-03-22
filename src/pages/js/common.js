/**
 * 통합된 헤더 및 공통 기능 스크립트 (백엔드 연동 준비 완료 버전)
 * [Role 분기] user_role: 'buyer'(기본), 'seller', 'admin'
 */

// ============================================================================
//  [API 통신 추상화 계층] 나중에 백엔드 API가 준비되면 이 내부를 교체합니다!
// ============================================================================
const UdongAPI = {
  // 1. 사용자 위치(동네) 정보 가져오기
  getUserLocations: async (role) => {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`http://localhost:8080/api/v1/users/locations?role=${role}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) return [];  // ← 403 등 에러 시 빈 배열 반환
    return await response.json();
  },

  // 2. 사용자 위치(동네) 정보 저장하기
  saveUserLocations: async (role, locations) => {
    const token = localStorage.getItem("udong_access_token");
    await fetch(`http://localhost:8080/api/v1/users/locations?role=${role}`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(locations)
    });
    return { success: true };
  },

  // 3. 사용자 알림 목록 가져오기
  getNotifications: async (role, isVerified) => {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`http://localhost:8080/api/v1/notifications`, { headers: { "Authorization": `Bearer ${token}` } });
    return await response.json();
  },

  // 4. 사용자 채팅 목록 가져오기
  getChats: async (role, isVerified) => {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`http://localhost:8080/api/v1/chats`, { headers: { "Authorization": `Bearer ${token}` } });
    return await response.json();
  },

  // 5. IP 체크 서버리스 통신
  checkServerlessIP: async () => {
    const response = await fetch(`http://localhost:8080/api/v1/auth/ip-check`);
    if (!response.ok) throw new Error("NETWORK_FAIL");
    return await response.json();
  },

  // -------------------------------------------------------------------------
  // [지역 필터링용 신규 추가 API 모음]
  // 기존의 무거운 regions.json 통째 로딩을 3단계 API 통신으로 쪼갭니다.
  // -------------------------------------------------------------------------

  // 6. 시/도 목록만 가져오기 (1단계)
  getSidoList: async () => {
    const response = await fetch('http://localhost:8080/api/v1/regions/sido');
    return await response.json();
  },

  // 7. 특정 시/도의 시/군/구 목록 가져오기 (2단계)
  getSigunguList: async (sido) => {
    const response = await fetch(`http://localhost:8080/api/v1/regions/sigungu?sido=${encodeURIComponent(sido)}`);
    return await response.json();
  },

  // 8. 특정 시/군/구의 동 목록 가져오기 (3단계)
  getDongList: async (sido, sigungu) => {
    const response = await fetch(`http://localhost:8080/api/v1/regions/dong?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`);
    return await response.json();
  },
};
// ============================================================================

// ★ 도로명 JSON 다운로드 (추후 이 부분도 서버 API 검색으로 교체 가능)
window.loadRoadData = function (callback) {
  if (window.roadMappingData) {
    if (callback) callback();
    return;
  }
  fetch("../../assets/road_names_total.json")
    .then((res) => res.json())
    .then((data) => {
      window.roadMappingData = data;
      if (callback) callback();
    })
    .catch((err) => {
      console.warn("도로명 데이터 로드 실패", err);
      if (callback) callback();
    });
};

window.udongCalculateDistance = function (lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 99999;
  const R = 6371e3;
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

window.getMatchedRoadName = function (fullPath) {
  if (!fullPath || fullPath === "전체 지역" || fullPath === "동네 인증")
    return fullPath;
  if (fullPath.endsWith("로") || fullPath.endsWith("길")) return fullPath;

  if (window.roadMappingData) {
    const cleanStr = fullPath.replace(/>/g, " ").replace(/\s+/g, " ").trim();
    const parts = cleanStr.split(" ");
    const dong = parts[parts.length - 1];
    const sido = parts.length > 1 ? parts[0] : "";
    const sigungu = parts.length > 2 ? parts[1] : "";

    if (sido && sigungu) {
      const FULL_SIDO_MAP = {
        서울: "서울특별시",
        경기: "경기도",
        인천: "인천광역시",
        부산: "부산광역시",
        대구: "대구광역시",
        광주: "광주광역시",
        대전: "대전광역시",
        울산: "울산광역시",
        세종: "세종특별자치시",
        강원: "강원특별자치도",
        충북: "충청북도",
        충남: "충청남도",
        전북: "전북특별자치도",
        전남: "전라남도",
        경북: "경상북도",
        경남: "경상남도",
        제주: "제주특별자치도",
      };
      const normSido = FULL_SIDO_MAP[sido] || sido;
      const exactKey1 = `${normSido} ${sigungu} ${dong}`;
      const exactKey2 = `${normSido} ${sigungu} ${dong.replace("제", "")}`;

      if (window.roadMappingData[exactKey1])
        return window.roadMappingData[exactKey1][0];
      if (window.roadMappingData[exactKey2])
        return window.roadMappingData[exactKey2][0];

      const prefix = `${normSido} ${sigungu}`;
      for (const k in window.roadMappingData) {
        if (
          k.startsWith(prefix) &&
          (k.endsWith(" " + dong) || k.endsWith(" " + dong.replace("제", "")))
        ) {
          return window.roadMappingData[k][0];
        }
      }
    } else {
      for (const k in window.roadMappingData) {
        if (k.endsWith(" " + dong)) return window.roadMappingData[k][0];
      }
    }
  }
  return fullPath.includes(">")
    ? fullPath.split(">").pop().trim()
    : fullPath.split(" ").pop();
};

window.getUpperRegion = function (dongName) {
  if (!dongName) return "";
  if (
    dongName.includes("역삼") ||
    dongName.includes("논현") ||
    dongName.includes("청담") ||
    dongName.includes("삼성") ||
    dongName.includes("도곡") ||
    dongName.includes("대치") ||
    dongName.includes("신사") ||
    dongName.includes("압구정") ||
    dongName.includes("개포")
  )
    return "서울특별시 강남구";
  if (
    dongName.includes("서초") ||
    dongName.includes("반포") ||
    dongName.includes("방배") ||
    dongName.includes("잠원")
  )
    return "서울특별시 서초구";
  if (
    dongName.includes("시흥") ||
    dongName.includes("독산") ||
    dongName.includes("가산")
  )
    return "서울특별시 금천구";
  if (
    dongName.includes("잠실") ||
    dongName.includes("가락") ||
    dongName.includes("문정")
  )
    return "서울특별시 송파구";
  if (
    dongName.includes("서교") ||
    dongName.includes("망원") ||
    dongName.includes("연남")
  )
    return "서울특별시 마포구";
  return "서울특별시";
};

window.getAddrKey = function () {
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  if (!isLoggedIn) return "udong_addr_type_guest";
  const role = localStorage.getItem("udong_user_role") || "buyer";
  return `udong_addr_type_${role}`;
};

window.updateHeaderLocationUI = async function () {
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  const userRole = localStorage.getItem("udong_user_role") || "buyer";
  const isRoadAddr = localStorage.getItem(window.getAddrKey()) === "road";
  const locMainText = document.getElementById("locMainText");
  const locUpperText = document.getElementById("locUpperText");

  if (!isLoggedIn) {
    if (locMainText) locMainText.innerText = "동네 인증";
    if (locUpperText) locUpperText.style.display = "none";
    return;
  }

  let currentLocName = userRole === "buyer" ? "동네 인증" : "전체 지역";
  let upperText = "";

  try {
    const locsRaw = await UdongAPI.getUserLocations(userRole);
    const locs = Array.isArray(locsRaw) ? locsRaw : [];
    const selected = locs.find((l) => l.selected);

    if (selected) {
      if (userRole === "buyer") {
        if (isRoadAddr && selected.roadName) {
          currentLocName = selected.roadName;
        } else if (selected.dong) {
          currentLocName = selected.dong;
        } else {
          currentLocName = selected.name.includes(">")
            ? selected.name.split(">").pop().trim()
            : selected.name;
        }
      } else {
        if (isRoadAddr && typeof window.getMatchedRoadName === "function") {
          const savedRoad = localStorage.getItem("udong_selected_road_name");
          currentLocName =
            savedRoad || window.getMatchedRoadName(selected.name);
        } else {
          currentLocName = selected.name.includes(">")
            ? selected.name.split(">").pop().trim()
            : selected.name;
        }
      }
      upperText = selected.name.includes(">")
        ? selected.name.split(">").slice(0, -1).join(" ")
        : (selected.sido && selected.sigungu)
            ? `${selected.sido} ${selected.sigungu}`
            : window.getUpperRegion(currentLocName);
    }
  } catch (e) {
    console.error("헤더 위치 업데이트 실패:", e);
  }

  if (locMainText) locMainText.innerText = currentLocName;
  if (locUpperText) {
    locUpperText.innerText = upperText;
    locUpperText.style.display =
      upperText &&
      currentLocName !== "동네 인증" &&
      currentLocName !== "전체 지역"
        ? "block"
        : "none";
  }
};

function getUserInfo() {
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  if (!isLoggedIn) return null;
  return JSON.parse(localStorage.getItem("udong_user_info"));
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("udong_is_logged_in") === null) {
    localStorage.setItem("udong_is_logged_in", "false");
    localStorage.removeItem("udong_user_role");
  }

  const userRole = localStorage.getItem("udong_user_role");
  const defaultLocs = [{ name: "전체 지역", selected: true }];
  if (userRole === "seller" && !localStorage.getItem("udong_seller_location"))
    localStorage.setItem("udong_seller_location", JSON.stringify(defaultLocs));
  else if (
    userRole === "admin" &&
    !localStorage.getItem("udong_admin_location")
  )
    localStorage.setItem("udong_admin_location", JSON.stringify(defaultLocs));
  else if (
    userRole === "buyer" &&
    !localStorage.getItem("udong_buyer_locations")
  )
    localStorage.setItem("udong_buyer_locations", "[]");

  if (!localStorage.getItem("udong_addr_type"))
    localStorage.setItem("udong_addr_type", "dong");

  window.loadRoadData(async () => {
    try {
      if (!window.__skipHeader) {  // ← SignupComplete 등 헤더 불필요한 페이지에서 주입 방지
        await injectHeader();
        injectFooter();
      }
    } catch (e) {
      console.error("Header/Footer Error:", e);
    }
    try {
      await initCommon();
    } catch (e) {
      console.error("Common Init Error:", e);
    }
    if (typeof initLoginToggle === "function") initLoginToggle();
  });
});

async function injectHeader() {
  if (document.querySelector(".header")) return;

  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  const userRole = localStorage.getItem("udong_user_role") || "buyer";
  const isRoadAddr = localStorage.getItem(window.getAddrKey()) === "road";

  let initialLocation = "동네 인증";
  let isBuyerVerified = false;
  let savedLocs = [];  // ← 스코프 밖으로 이동

  if (isLoggedIn) {
    try {
      const savedLocsRaw = await UdongAPI.getUserLocations(userRole);
      savedLocs = Array.isArray(savedLocsRaw) ? savedLocsRaw : [];
      if (userRole === "admin" || userRole === "seller") {
        const selected = savedLocs.find((l) => l.selected);
        initialLocation = selected ? selected.name : "전체 지역";
        if (initialLocation.includes(">"))
          initialLocation = initialLocation.split(">").pop().trim();
      } else {
        if (savedLocs && savedLocs.length > 0) {
          const selected = savedLocs.find((loc) => loc.selected);
          if (selected) {
            initialLocation = selected.name;
            if (selected.verified && !selected.expired) isBuyerVerified = true;
          }
        }
      }
    } catch (e) {
      console.error("동네 정보 로드 실패", e);
    }
  }

  let rightMenuHTML = "";
  if (isLoggedIn) {
    const myInfo = getUserInfo() || { nickname: "익명" };

    if (userRole === "seller") {
      rightMenuHTML = `
        <div class="header-action-item" id="chatMenuContainer"><span class="header-action">채팅</span><span class="badge" id="chatBadge" style="display: none;">0</span><div class="action-dropdown" id="chatDropdown"><ul class="dropdown-list" id="chatList"></ul></div></div>
        <div class="header-action-item" id="notiMenuContainer"><span class="header-action">알림</span><span class="badge" id="notiBadge" style="display: none;">0</span><div class="action-dropdown" id="notiDropdown"><ul class="dropdown-list" id="notiList"></ul></div></div>
        <div class="header-action-item user-dropdown-container" id="userMenuContainer"><span class="header-action user-nickname" title="${myInfo.nickname}">${myInfo.nickname}님</span><div class="action-dropdown" id="userMenuDropdown"><ul class="dropdown-list"><li class="user-menu-item" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); localStorage.removeItem('udong_access_token'); localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem('userId'); sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('userId'); location.href='http://localhost:5500/src/pages/main/main.html';">로그아웃</li></ul></div></div>
        <a href="/html/mypage/seller.html" class="btn-partner" onclick="alert('판매자 마이페이지로 이동합니다.'); return false;">파트너 센터</a>
      `;
    } else if (userRole === "admin") {
      rightMenuHTML = `
        <span class="header-action" style="color:var(--admin-red); font-weight:800;">ADMIN</span>
        <a href="#" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); localStorage.removeItem('udong_access_token'); localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem('userId'); sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('userId'); location.href='http://localhost:5500/src/pages/main/main.html';" class="header-action">로그아웃</a>
        <a href="/html/mypage/admin.html" class="btn-admin-center" onclick="alert('관리자 마이페이지로 이동합니다.'); return false;">관리자 센터</a>
      `;
    } else {
      let chatMenuHTML = "";
      if (isBuyerVerified) {
        chatMenuHTML = `<div class="header-action-item" id="chatMenuContainer"><span class="header-action">채팅</span><span class="badge" id="chatBadge" style="display: none;">0</span><div class="action-dropdown" id="chatDropdown"><ul class="dropdown-list" id="chatList"></ul></div></div>`;
      }
      rightMenuHTML = `
        ${chatMenuHTML}
        <div class="header-action-item" id="notiMenuContainer"><span class="header-action">알림</span><span class="badge" id="notiBadge" style="display: none;">0</span><div class="action-dropdown" id="notiDropdown"><ul class="dropdown-list" id="notiList"></ul></div></div>
        <div class="header-action-item user-dropdown-container" id="userMenuContainer"><span class="header-action user-nickname" title="${myInfo.nickname}">${myInfo.nickname}님</span><div class="action-dropdown" id="userMenuDropdown"><ul class="dropdown-list"><li class="user-menu-item" onclick="location.href='/html/mypage/main.html'">마이페이지</li><li class="user-menu-item" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); localStorage.removeItem('udong_access_token'); localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem('userId'); sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('userId'); location.href='http://localhost:5500/src/pages/main/main.html';">로그아웃</li></ul></div></div>
        <a href="#" id="btnOpenGroup" class="btn-open-group">공구 열기</a>
      `;
    }
  } else {
    rightMenuHTML = `
      <a href="../Login.html" class="header-action btn-login-text">로그인/회원가입</a>
      <a href="#" id="btnOpenGroup" class="btn-open-group disabled">공구 열기</a>
    `;
  }

  const searchPlaceholder =
    userRole === "admin"
      ? "회원명, 게시글 제목, 신고내역 검색"
      : "검색어를 입력하세요.";
  let navLinksHTML =
    userRole === "admin"
      ? `<a href="#" class="nav-link-secondary" id="communityLink">동네 커뮤니티</a>`
      : `<a href="#" class="nav-link-item" onclick="handleNavLinkClick(this); alert('서비스 이용 방법 안내 페이지입니다. (준비중)'); return false;">이용 방법</a><a href="#" class="nav-link-secondary" id="communityLink">동네 커뮤니티</a>`;

  const upperRegionText =
    initialLocation !== "동네 인증" && initialLocation !== "전체 지역"
      ? (() => {
          const sel = savedLocs.find(l => l.selected);
          return (sel?.sido && sel?.sigungu)
            ? `${sel.sido} ${sel.sigungu}`
            : window.getUpperRegion(initialLocation);
        })()
      : "";

  const headerHTML = `
    <header class="header">
      <a href="main.html" id="headerLogoLink" class="header-logo-link">
        <img src="../../assets/logo.png" alt="우동마켓" class="header-logo" />
        <div class="header-logo-text"><img src="../../assets/logo-text.png" alt="우동마켓" /></div>
      </a>
      <div class="location-container" id="locationContainerBlock">
        <div class="location" id="locationBtn">
           <div class="loc-text-wrapper">
               <span class="loc-upper" id="locUpperText" style="display:${upperRegionText ? "block" : "none"};">${upperRegionText}</span>
               <div class="loc-main-row">
                   <span class="location-text" id="locMainText">${initialLocation}</span>
                   <span class="location-arrow">▾</span>
               </div>
           </div>
        </div>
        <ul class="location-dropdown" id="locationList"></ul>
      </div>
      <div style="display:flex; align-items:center; gap:6px; margin-right:20px; white-space:nowrap; flex-shrink:0;">
          <span style="font-size:12px; font-weight:700; color:#868e96; white-space:nowrap;">도로명</span>
          <div style="position:relative; width:34px; height:18px; display:inline-block;">
             <input type="checkbox" id="globalAddrToggle" ${isRoadAddr ? "checked" : ""} style="opacity:0; width:0; height:0; position:absolute; z-index:-1;">
             <label for="globalAddrToggle" id="addrToggleBg" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:${isRoadAddr ? "#ff6f0f" : "#ccc"}; border-radius:18px; transition:.3s;"></label>
             <span id="addrToggleKnob" style="position:absolute; cursor:pointer; pointer-events:none; height:14px; width:14px; left:${isRoadAddr ? "18px" : "2px"}; bottom:2px; background-color:white; border-radius:50%; transition:.3s;"></span>
          </div>
      </div>
      <div class="nav-links">${navLinksHTML}</div>
      <div class="search-bar" style="width:320px;">
        <input type="text" class="search-input" id="searchInput" placeholder="${searchPlaceholder}" autocomplete="off" />
        <button type="button" id="searchClearBtn" class="btn-clear" style="display: none">✕</button>
        <a href="#" class="search-icon" id="searchBtn">🔍</a>
        <div id="searchHistoryLayer" class="search-history-layer" style="display:none;">
            <div class="history-header"><span>최근 검색어</span><button id="btnDeleteAllHistory" class="btn-delete-all">전체 삭제</button></div>
            <ul id="searchHistoryList" class="history-list"></ul>
        </div>
      </div>
      <div class="header-actions">${rightMenuHTML}</div>
    </header>
  `;

  const container = document.getElementById("header-container");
  if (container) container.innerHTML = headerHTML;
  else
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div id="header-container">${headerHTML}</div>`,
    );

  const addrToggle = document.getElementById("globalAddrToggle");
  const toggleBg = document.getElementById("addrToggleBg");
  const toggleKnob = document.getElementById("addrToggleKnob");

  if (addrToggle) {
    addrToggle.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      localStorage.setItem(window.getAddrKey(), isChecked ? "road" : "dong");
      if (toggleBg)
        toggleBg.style.backgroundColor = isChecked ? "#ff6f0f" : "#ccc";
      if (toggleKnob) toggleKnob.style.left = isChecked ? "18px" : "2px";

      await window.updateHeaderLocationUI();
      window.dispatchEvent(new Event("addrTypeChange"));
    });
  }
  await window.updateHeaderLocationUI();
}

function injectFooter() {
  if (document.querySelector(".footer")) return;
  const footerHTML = `
    <footer class="footer" style="width: 100%; height: 120px; background-color: #343a40; color: #adb5bd; display: flex; justify-content: center; align-items: center; margin-top: auto; z-index: 100; flex-shrink: 0;">
      <div class="footer-content">© 2026 Udong Market. All rights reserved.</div>
    </footer>
  `;
  const mainContainer = document.querySelector(".main-container");
  if (mainContainer) mainContainer.insertAdjacentHTML("beforeend", footerHTML);
  else document.body.insertAdjacentHTML("beforeend", footerHTML);
}

function handleNavLinkClick(el) {
  document
    .querySelectorAll(".nav-links a")
    .forEach((a) => a.classList.remove("active"));
  el.classList.add("active");
}

async function initCommon() {
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  const userRole = localStorage.getItem("udong_user_role") || "buyer";

  const locationContainer = document.getElementById("locationContainerBlock");
  const locationBtn = document.getElementById("locationBtn");
  const locationList = document.getElementById("locationList");
  const locMainText = document.getElementById("locMainText");
  const btnOpenGroup = document.getElementById("btnOpenGroup");
  const communityLink = document.getElementById("communityLink");

  const chatContainer = document.getElementById("chatMenuContainer");
  const notiContainer = document.getElementById("notiMenuContainer");
  const userContainer = document.getElementById("userMenuContainer");
  const chatDropdown = document.getElementById("chatDropdown");
  const notiDropdown = document.getElementById("notiDropdown");
  const userDropdown = document.getElementById("userMenuDropdown");

  let myLocations = [];
  try {
    const result = await UdongAPI.getUserLocations(userRole);
    myLocations = Array.isArray(result) ? result : [];
  } catch (e) {
    myLocations = [];
  }

  // 데이터 로드를 위해 async로 변경
  window.addEventListener("addrTypeChange", async () => {
    if (typeof renderDropdown === "function") await renderDropdown();
  });

  if (userRole === "buyer") {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    let isModified = false;
    myLocations.forEach((loc) => {
      if (loc.authDate && Date.now() - loc.authDate > THIRTY_DAYS) {
        if (!loc.expired) {
          loc.expired = true;
          loc.verified = false;
          isModified = true;
        }
      }
    });
    if (isModified) {
      await UdongAPI.saveUserLocations(userRole, myLocations);
      alert(
        "인증한 지 30일이 지나 만료된 지역이 있습니다. 재인증을 진행해주세요.",
      );
    }
  }

  if (communityLink) {
    communityLink.addEventListener("click", (e) => {
      if (!isLoggedIn) {
        e.preventDefault();
        alert("동네 커뮤니티는 로그인 후 이용 가능합니다.");
        return;
      }
      const currentLocName = locMainText ? locMainText.innerText : "";
      if (userRole === "buyer") {
        const currentLoc = myLocations.find((l) => l.selected);
        if (!currentLoc || !currentLoc.verified || currentLoc.expired) {
          e.preventDefault();
          alert(
            "동네 커뮤니티는 동네 인증 완료 후에만 이용 가능합니다.\n(만료된 경우 재인증 필요)",
          );
          return;
        }
      } else if (userRole === "seller" || userRole === "admin") {
        if (currentLocName === "전체 지역") {
          e.preventDefault();
          alert(
            "전체 지역 모드에서는 동네 커뮤니티를 이용할 수 없습니다.\n특정 지역을 선택해주세요.",
          );
          return;
        }
      }
      handleNavLinkClick(communityLink);
    });
  }

  if (btnOpenGroup) {
    btnOpenGroup.addEventListener("click", (e) => {
      e.preventDefault();
      if (btnOpenGroup.classList.contains("disabled")) {
        if (!isLoggedIn) {
          if (confirm("로그인이 필요한 서비스입니다.\n로그인 하시겠습니까?"))
            location.href = '../Login.html';
        } else if (userRole === "buyer") {
          alert("📢 유효한 동네 인증을 완료해야 공구를 열 수 있습니다!");
        }
        return;
      }
      location.href = "../post/bid.html";
    });
  }

  // 비동기 통신을 대응하도록 변경된 지역 필터 렌더링 함수
  async function renderDropdown() {
    if (!locationList) return;
    locationList.innerHTML = "";

    const isRoadState = localStorage.getItem(window.getAddrKey()) === "road";

    if (!isLoggedIn) {
      const infoLi = document.createElement("li");
      infoLi.innerHTML = `
        <div style="text-align:center; padding:10px 5px; color:#868e96; font-size:13px; line-height:1.4;">
          로그인 후<br><strong>인증</strong>을 진행해주세요.
        </div>
        <button onclick="location.href='../Login.html'" style="width:100%; margin-top:5px; background:#f1f3f5; border:none; padding:8px; border-radius:4px; font-weight:700; cursor:pointer; color:#495057;">로그인하기</button>
      `;
      infoLi.style.cursor = "default";
      locationList.appendChild(infoLi);
    } else {
      if (userRole === "seller" || userRole === "admin") {
        locationList.parentElement
          .querySelector(".location-dropdown")
          .classList.add("hierarchical");

        const allItem = document.createElement("li");
        allItem.className = "h-item active";
        allItem.style.marginBottom = "10px";
        allItem.style.fontWeight = "bold";
        allItem.style.cursor = "pointer";
        allItem.innerText = "📍 전체 지역";
        allItem.onclick = async () => await updateManagerLocation("전체 지역");
        locationList.appendChild(allItem);

        const cascadeContainer = document.createElement("li");
        cascadeContainer.style.display = "flex";
        cascadeContainer.style.gap = "8px";
        cascadeContainer.style.height = "250px";
        cascadeContainer.style.borderTop = "1px solid #eee";
        cascadeContainer.style.paddingTop = "10px";
        cascadeContainer.onclick = (e) => e.stopPropagation();

        const colSido = document.createElement("ul");
        const colSigungu = document.createElement("ul");
        const colDong = document.createElement("ul");

        colSigungu.style.display = "none";
        colDong.style.display = "none";

        [colSido, colSigungu, colDong].forEach((col) => {
          col.style.flex = "1";
          col.style.overflowY = "auto";
          col.style.margin = "0";
          col.style.padding = "0";
          col.style.listStyle = "none";
          col.style.border = "1px solid #f1f3f5";
          col.style.borderRadius = "4px";
          col.style.backgroundColor = "#fafafa";
        });

        cascadeContainer.appendChild(colSido);
        cascadeContainer.appendChild(colSigungu);
        cascadeContainer.appendChild(colDong);
        locationList.appendChild(cascadeContainer);

        function renderCascadeList(colElement, items, onSelect) {
          colElement.innerHTML = "";
          items.forEach((item) => {
            const li = document.createElement("li");
            li.innerText = item.label || item;
            li.style.padding = "8px 10px";
            li.style.cursor = "pointer";
            li.style.fontSize = "12px";
            li.style.borderBottom = "1px solid #eee";
            li.style.color = "#495057";
            li.onmouseenter = () => (li.style.backgroundColor = "#e9ecef");
            li.onmouseleave = () => {
              if (li.dataset.selected !== "true")
                li.style.backgroundColor = "transparent";
            };
            li.onclick = (e) => {
              e.stopPropagation();
              Array.from(colElement.children).forEach((child) => {
                child.style.backgroundColor = "transparent";
                child.style.fontWeight = "normal";
                child.dataset.selected = "false";
              });
              li.style.backgroundColor = "#e9ecef";
              li.style.fontWeight = "bold";
              li.dataset.selected = "true";
              onSelect(item);
            };
            colElement.appendChild(li);
          });
        }

        colSido.innerHTML =
          "<li style='padding:10px; font-size:12px; color:#868e96; text-align:center;'>로딩중...</li>";

        // ====================================================================
        //  대폭 단순화된 3단계 API 통신 연동 흐름
        // ====================================================================
        try {
          // 1단계: API를 통해 시/도 목록 요청
          const sidos = await UdongAPI.getSidoList();

          renderCascadeList(colSido, sidos, async (selectedSido) => {
            colSigungu.style.display = "block";
            colDong.style.display = "none";
            colSigungu.innerHTML =
              "<li style='padding:10px; font-size:12px; color:#868e96; text-align:center;'>로딩중...</li>";

            // 2단계: API를 통해 시/군/구 목록 요청
            const sigungus = await UdongAPI.getSigunguList(selectedSido);

            renderCascadeList(colSigungu, sigungus, async (selectedSigungu) => {
              colDong.style.display = "block";
              colDong.innerHTML =
                "<li style='padding:10px; font-size:12px; color:#868e96; text-align:center;'>로딩중...</li>";

              // 3단계: API를 통해 읍/면/동 목록 요청
              const dongs = await UdongAPI.getDongList(
                selectedSido,
                selectedSigungu,
              );

              // 화면 렌더링 및 도로명 데이터 가공 (프론트엔드 로직 유지)
              let listToRender = [];
              let roadToDongsMap = {};

              if (isRoadState) {
                const FULL_SIDO_MAP = {
                  서울: "서울특별시",
                  부산: "부산광역시",
                  대구: "대구광역시",
                  인천: "인천광역시",
                  광주: "광주광역시",
                  대전: "대전광역시",
                  울산: "울산광역시",
                  세종: "세종특별자치시",
                  경기: "경기도",
                  강원: "강원특별자치도",
                  충북: "충청북도",
                  충남: "충청남도",
                  전북: "전북특별자치도",
                  전남: "전라남도",
                  경북: "경상북도",
                  경남: "경상남도",
                  제주: "제주특별자치도",
                  충청북: "충청북도",
                  충청남: "충청남도",
                  전라북: "전북특별자치도",
                  전라남: "전라남도",
                  경상북: "경상북도",
                  경상남: "경상남도",
                };
                const normSido = FULL_SIDO_MAP[selectedSido] || selectedSido;

                dongs.forEach((dong) => {
                  const searchKey = `${normSido} ${selectedSigungu} ${dong}`;
                  if (
                    window.roadMappingData &&
                    window.roadMappingData[searchKey]
                  ) {
                    window.roadMappingData[searchKey].forEach((road) => {
                      listToRender.push({ label: road, value: dong });
                      if (!roadToDongsMap[road]) roadToDongsMap[road] = [];
                      roadToDongsMap[road].push(dong);
                    });
                  } else {
                    const fallbackRoad = dong.replace(/동$/, "로");
                    listToRender.push({ label: fallbackRoad, value: dong });
                    if (!roadToDongsMap[fallbackRoad])
                      roadToDongsMap[fallbackRoad] = [];
                    roadToDongsMap[fallbackRoad].push(dong);
                  }
                });

                const uniqueMap = new Map();
                listToRender.forEach((item) => {
                  if (!uniqueMap.has(item.label))
                    uniqueMap.set(item.label, item);
                });
                listToRender = Array.from(uniqueMap.values()).sort((a, b) =>
                  a.label.localeCompare(b.label, "ko"),
                );
              } else {
                listToRender = dongs.map((d) => ({ label: d, value: d }));
              }

              renderCascadeList(colDong, listToRender, async (selectedItem) => {
                let targetDong = selectedItem.value;

                if (isRoadState) {
                  localStorage.setItem(
                    "udong_selected_road_name",
                    selectedItem.label,
                  );
                  let realCurrentDong = "";
                  try {
                    const sel = myLocations.find((l) => l.selected);
                    if (sel)
                      realCurrentDong = sel.name.includes(">")
                        ? sel.name.split(">").pop().trim()
                        : sel.name;
                  } catch (e) {}

                  const possibleDongs = roadToDongsMap[selectedItem.label] || [
                    targetDong,
                  ];
                  if (possibleDongs.includes(realCurrentDong)) {
                    targetDong = realCurrentDong;
                  } else {
                    targetDong = possibleDongs[0];
                  }
                } else {
                  localStorage.removeItem("udong_selected_road_name");
                }

                const fullPath = `${selectedSido} > ${selectedSigungu} > ${targetDong}`;
                await updateManagerLocation(fullPath);
              });
            });
          });
        } catch (err) {
          colSido.innerHTML =
            "<li style='padding:10px; font-size:11px; color:red;'>목록 로드 실패</li>";
          console.error("지역 목록 가져오기 에러:", err);
        }
      } else {
        if (locationList.parentElement.querySelector(".location-dropdown")) {
          locationList.parentElement
            .querySelector(".location-dropdown")
            .classList.remove("hierarchical");
        }

        if (myLocations.length === 0) {
          const emptyLi = document.createElement("li");
          emptyLi.innerText = "아직 인증된 동네가 없습니다.";
          emptyLi.style.color = "#868e96";
          locationList.appendChild(emptyLi);
        } else {
          myLocations.forEach((loc, index) => {
            const li = document.createElement("li");
            let displayDong = loc.name;
            const isRoadState =
              localStorage.getItem(window.getAddrKey()) === "road";

            if (loc.dong) {
              displayDong =
                isRoadState && loc.roadName ? loc.roadName : loc.dong;
            } else if (loc.name !== "전체 지역" && loc.name !== "동네 인증") {
              displayDong = loc.name.includes(">")
                ? loc.name.split(">").pop().trim()
                : loc.name;
            }

            let htmlContent = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><span>${displayDong}</span>`;

            if (loc.expired) {
              htmlContent += `<button style="background:#fa5252; color:white; border:none; padding:3px 6px; border-radius:4px; font-size:11px; font-weight:700; cursor:pointer;" onclick="event.stopPropagation(); window.startGpsAuth(${index});">재인증</button></div>`;
            } else if (loc.verified) {
              htmlContent += `<span style="font-size:11px; color:#2B8A3E;">(인증✅)</span></div>`;
            } else {
              htmlContent += `</div>`;
            }
            li.innerHTML = htmlContent;
            if (loc.selected) li.classList.add("active");
            li.addEventListener("click", () => selectLocation(index));
            locationList.appendChild(li);
          });
        }
        const gpsLi = document.createElement("li");
        gpsLi.className = "setting";
        gpsLi.innerHTML = `📍 새 동네 추가/인증`;
        gpsLi.addEventListener("click", () => window.startGpsAuth(-1));
        locationList.appendChild(gpsLi);

        if (myLocations.length > 0) {
          const resetLi = document.createElement("li");
          resetLi.innerHTML = `<span style="color:#fa5252; font-size:13px; font-weight:700;">🗑️ 인증 목록 초기화</span>`;
          resetLi.style.borderTop = "1px solid #eee";
          resetLi.style.marginTop = "5px";
          resetLi.style.paddingTop = "10px";
          resetLi.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (confirm("모든 인증 목록을 초기화 하시겠습니까?")) {
              await UdongAPI.saveUserLocations(userRole, []);
              location.reload();
            }
          });
          locationList.appendChild(resetLi);
        }
      }

      if (btnOpenGroup && userRole === "buyer") {
        const currentLoc = myLocations.find((loc) => loc.selected);
        if (currentLoc && currentLoc.verified && !currentLoc.expired) {
          btnOpenGroup.classList.remove("disabled");
        } else {
          btnOpenGroup.classList.add("disabled");
        }
      }
    }
  }

  async function updateManagerLocation(fullPath) {
    const newLocs = [
      {
        name: fullPath === "전체 지역" ? "전체 지역" : fullPath,
        selected: true,
      },
    ];
    await UdongAPI.saveUserLocations(userRole, newLocs);
    myLocations = newLocs;

    await window.updateHeaderLocationUI();
    await renderDropdown(); // async 호출 반영
    window.dispatchEvent(new Event("locationChange"));
    if (locationContainer) locationContainer.classList.remove("active");
  }

  async function updateHeaderNotifications() {
    if (!isLoggedIn) return;
    const chatBadge = document.getElementById("chatBadge");
    const notiBadge = document.getElementById("notiBadge");
    const chatList = document.getElementById("chatList");
    const notiList = document.getElementById("notiList");

    let isVerified = false;
    let currentMyLocations = [];
    try {
      const result = await UdongAPI.getUserLocations(userRole);
      currentMyLocations = Array.isArray(result) ? result : [];
    } catch (e) {
      currentMyLocations = [];
    }

    if (userRole === "buyer") {
      const currentLoc = currentMyLocations.find((l) => l.selected);
      isVerified = currentLoc && currentLoc.verified && !currentLoc.expired;
    } else {
      isVerified = true;
    }

    const mockChats = await UdongAPI.getChats(userRole, isVerified);
    const mockNotis = await UdongAPI.getNotifications(userRole, isVerified);

    function renderList(listEl, badgeEl, data, type) {
      if (!listEl) return;
      listEl.innerHTML = "";
      const unreadCount = data.filter((i) => i.unread).length;
      if (badgeEl) {
        if (unreadCount > 0) {
          badgeEl.innerText = unreadCount;
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }
      }
      if (data.length === 0) {
        listEl.innerHTML = `<div class="empty-message">새로운 ${type === "chat" ? "채팅이" : "알림이"} 없습니다.</div>`;
        return;
      }
      data.forEach((item) => {
        const li = document.createElement("div");
        li.className = `dropdown-item ${item.unread ? "unread" : ""}`;
        li.innerHTML = `<div class="item-title">${item.title}</div><div class="item-desc">${item.desc}</div><div class="item-date">${item.date}</div>`;
        li.onclick = () =>
          alert(
            `${type === "chat" ? "채팅방" : "해당 페이지"}으로 이동합니다.`,
          );
        listEl.appendChild(li);
      });
    }

    if (chatList) renderList(chatList, chatBadge, mockChats, "chat");
    if (notiList) renderList(notiList, notiBadge, mockNotis, "noti");
  }

  if (isLoggedIn) {
    updateHeaderNotifications();
    window.addEventListener("locationChange", updateHeaderNotifications);

    if (chatContainer) {
      chatContainer.addEventListener("click", (e) => {
        e.stopPropagation();
        chatDropdown.classList.toggle("active");
        if (notiDropdown) notiDropdown.classList.remove("active");
        if (userDropdown) userDropdown.classList.remove("active");
        if (locationContainer) locationContainer.classList.remove("active");
      });
    }
    if (notiContainer) {
      notiContainer.addEventListener("click", (e) => {
        e.stopPropagation();
        notiDropdown.classList.toggle("active");
        if (chatDropdown) chatDropdown.classList.remove("active");
        if (userDropdown) userDropdown.classList.remove("active");
        if (locationContainer) locationContainer.classList.remove("active");
      });
    }
    if (userContainer) {
      userContainer.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle("active");
        if (chatDropdown) chatDropdown.classList.remove("active");
        if (notiDropdown) notiDropdown.classList.remove("active");
        if (locationContainer) locationContainer.classList.remove("active");
      });
    }
  }

  window.startGpsAuth = async function (renewIndex = -1) {
    const LOCK_KEY = "udong_auth_lock";
    const ATTEMPT_KEY = "udong_auth_attempts";
    const ADDR_ATTEMPT_KEY = "udong_addr_search_attempts";

    const lockUntil = localStorage.getItem(LOCK_KEY);
    if (lockUntil && Date.now() < parseInt(lockUntil)) {
      alert("인증 실패가 누적되어 24시간 동안 인증이 제한된 상태입니다.");
      return;
    }

    const showLoading = () => {
      if (document.getElementById("authLoadingOverlay")) return;
      const loadingDiv = document.createElement("div");
      loadingDiv.id = "authLoadingOverlay";
      loadingDiv.style.cssText =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(3px);";
      loadingDiv.innerHTML = `
        <div style="background:white; padding:20px 30px; border-radius:12px; font-weight:700; color:#ff6f0f; box-shadow:0 10px 30px rgba(0,0,0,0.2); display:flex; align-items:center; gap:12px;">
          <span style="display:inline-block; width:24px; height:24px; border:3px solid #f1f3f5; border-top-color:#ff6f0f; border-radius:50%; animation:udong-spin 1s linear infinite;"></span>
          위치 정보를 확인하고 있습니다...
        </div>
        <style>@keyframes udong-spin { to { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(loadingDiv);
    };

    const hideLoading = () => {
      const el = document.getElementById("authLoadingOverlay");
      if (el) el.remove();
    };

    showLoading();

    let ipData;
    try {
      ipData = await UdongAPI.checkServerlessIP();
    } catch (e) {
      hideLoading();
      alert(
        "인증 서버와 통신할 수 없습니다.\n사유: 방화벽 차단, 망 단절, 오프라인 등\n사용자의 네트워크 상태를 확인해 주세요.",
      );
      return;
    }

    const blockedTypes = [
      "hosting",
      "is_satellite",
      "is_anycast",
      "is_anonymous",
      "is_vpn",
      "is_relay",
      "tor",
    ];
    if (blockedTypes.includes(ipData.type)) {
      hideLoading();
      let msg = `접속하신 네트워크(유형: ${ipData.type})는 보안상 인증이 불가능합니다.`;
      if (ipData.type === "is_relay" && ipData.os === "Mac") {
        msg +=
          "\n(Mac 사용자: iCloud 비공개 릴레이 설정 해제 후 다시 시도해 주세요.)";
      }
      alert(msg);
      return;
    }

    let targetIpLat = ipData.lat;
    let targetIpLon = ipData.lon;
    let forceAddressSearch = false;

    const suspiciousTypes = [
      "isp",
      "mobile",
      "business",
      "education",
      "government",
    ];
    if (suspiciousTypes.includes(ipData.type)) {
      const leakedCoords = await checkWebRTCLeak();
      if (leakedCoords) {
        targetIpLat = leakedCoords.lat;
        targetIpLon = leakedCoords.lon;
      }

      if (
        ipData.type === "business" &&
        ipData.threatScore >= 90 &&
        !leakedCoords &&
        ipData.os === "Windows"
      ) {
        forceAddressSearch = true;
      } else if (ipData.threatScore >= 50) {
        alert(
          "네트워크 상태가 비정상적입니다(우회 의심). 위치 인증이 불가하므로 주소 검색을 진행합니다.",
        );
        forceAddressSearch = true;
      }
    }

    const handleFailLock = (isAddr) => {
      const key = isAddr ? ADDR_ATTEMPT_KEY : ATTEMPT_KEY;
      let count = (parseInt(localStorage.getItem(key)) || 0) + 1;
      localStorage.setItem(key, count.toString());
      if (count >= 3) {
        localStorage.setItem(
          LOCK_KEY,
          (Date.now() + 24 * 60 * 60 * 1000).toString(),
        );
        alert("3회 인증 실패로 24시간 동안 인증이 제한됩니다.");
        location.reload();
        return true;
      }
      return false;
    };

    const processPostcodeSearch = () => {
      hideLoading();
      new daum.Postcode({
        oncomplete: (data) => {
          const geocoder = new kakao.maps.services.Geocoder();
          geocoder.addressSearch(data.address, (results, status) => {
            if (status === kakao.maps.services.Status.OK) {
              const isRoadState =
                localStorage.getItem(window.getAddrKey()) === "road";
              let displayAddr = data.address;
              if (isRoadState && data.roadAddress) {
                displayAddr = data.roadAddress;
              }
              showMapModal(
                parseFloat(results[0].y),
                parseFloat(results[0].x),
                displayAddr,
                true,
                data.zonecode || "",  // ← 우편번호 추가
              );
            }
          });
        },
      }).open();
    };

    const showMapModal = (lat, lon, address, isAddrMode, zipCode = "") => {
      hideLoading();
      const overlay = document.createElement("div");
      overlay.className = "auth-modal-overlay";
      overlay.innerHTML = `
        <div class="auth-modal-box">
          <h3 style="margin:0;">${isAddrMode ? "검색된 주소 확인" : "수집된 상세 주소"}</h3>
          <p id="modalAddrDisplay" style="margin:10px 0; color:#ff6f0f; font-weight:700;">${address}</p>
          <div id="authKakaoMap" class="auth-map-container"></div>
          <button id="btnAuthConfirm" class="auth-btn-main">인증 마치기</button>
          ${
            !isAddrMode
              ? `<button id="btnAuthRetry" class="auth-btn-sub" style="margin-bottom:8px;">재시도 (남은 기회: ${3 - (parseInt(localStorage.getItem(ATTEMPT_KEY)) || 0)}번)</button>
                 <button id="btnAuthToSearch" class="auth-btn-sub">주소 직접 검색</button>`
              : `<button id="btnAuthRetrySearch" class="auth-btn-sub">다시 검색 (남은 기회: ${3 - (parseInt(localStorage.getItem(ADDR_ATTEMPT_KEY)) || 0)}번)</button>`
          }
        </div>
      `;
      document.body.appendChild(overlay);

      const map = new kakao.maps.Map(document.getElementById("authKakaoMap"), {
        center: new kakao.maps.LatLng(lat, lon),
        level: 3,
      });
      const marker = new kakao.maps.Marker({
        position: map.getCenter(),
        draggable: true,
      });
      marker.setMap(map);

      let curLat = lat,
        curLon = lon;
      kakao.maps.event.addListener(marker, "dragend", () => {
        const p = marker.getPosition();
        curLat = p.getLat();
        curLon = p.getLng();
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.coord2Address(curLon, curLat, (r, status) => {
          if (status === kakao.maps.services.Status.OK && r[0]) {
            const isRoadState =
              localStorage.getItem(window.getAddrKey()) === "road";
            let displayAddr = r[0].address ? r[0].address.address_name : "";

            if (isRoadState) {
              if (r[0].road_address) {
                displayAddr = r[0].road_address.address_name;
                document.getElementById("modalAddrDisplay").innerText =
                  displayAddr;
              } else {
                geocoder.coord2RegionCode(
                  curLon,
                  curLat,
                  (regionRes, regStatus) => {
                    if (regStatus === kakao.maps.services.Status.OK) {
                      const hRegion =
                        regionRes.find((x) => x.region_type === "H") ||
                        regionRes[0];
                      let matchedRoad = "";
                      if (window.roadMappingData) {
                        for (const k in window.roadMappingData) {
                          if (k.endsWith(" " + hRegion.region_3depth_name)) {
                            matchedRoad = window.roadMappingData[k][0];
                            break;
                          }
                        }
                      }
                      if (matchedRoad) displayAddr = matchedRoad;
                    }
                    document.getElementById("modalAddrDisplay").innerText =
                      displayAddr;
                  },
                );
              }
            } else {
              document.getElementById("modalAddrDisplay").innerText =
                displayAddr;
            }
          }
        });
      });

      document.getElementById("btnAuthConfirm").onclick = async () => {
        const dist = window.udongCalculateDistance(
          curLat,
          curLon,
          targetIpLat,
          targetIpLon,
        );
        if (dist > 50000) {
          alert(
            isAddrMode
              ? "주소지가 네트워크 위치와 너무 멉니다 (50km 초과)."
              : "현재 위치가 네트워크 위치와 너무 멉니다.",
          );
          overlay.remove();
          if (!handleFailLock(isAddrMode))
            isAddrMode
              ? processPostcodeSearch()
              : window.startGpsAuth(renewIndex);
        } else {
          const geocoder = new kakao.maps.services.Geocoder();
          geocoder.coord2RegionCode(
            curLon,
            curLat,
            (regionResult, regionStatus) => {
              geocoder.coord2Address(
                curLon,
                curLat,
                async (addrResult, addrStatus) => {
                  if (regionStatus === kakao.maps.services.Status.OK) {
                    const hRegion =
                      regionResult.find((r) => r.region_type === "H") ||
                      regionResult[0];
                    // 법정동 (B 타입) 추출 → 예: 방배3동 → 방배동
                    const bRegion = regionResult.find((r) => r.region_type === "B");
                    const legalDong = bRegion ? bRegion.region_3depth_name : hRegion.region_3depth_name;

                    let realRoadName = "";
                    if (
                      addrStatus === kakao.maps.services.Status.OK &&
                      addrResult[0].road_address
                    ) {
                      realRoadName = addrResult[0].road_address.road_name;
                    } else if (window.roadMappingData) {
                      const dName = hRegion.region_3depth_name;
                      for (const k in window.roadMappingData) {
                        if (
                          k.endsWith(" " + dName) ||
                          k.endsWith(" " + dName.replace("제", ""))
                        ) {
                          realRoadName = window.roadMappingData[k][0];
                          break;
                        }
                      }
                    }
                    if (!realRoadName)
                      realRoadName = hRegion.region_3depth_name;

                    let myLocs = await UdongAPI.getUserLocations("buyer");
                    const fullAddr =
                      document.getElementById("modalAddrDisplay").innerText;

                    const newAuthData = {
                      name: fullAddr,
                      sido: hRegion.region_1depth_name,
                      sigungu: hRegion.region_2depth_name,
                      dong: hRegion.region_3depth_name,  // 행정동 (방배3동)
                      legalDong: legalDong,               // 법정동 (방배동) ← 추가
                      roadName: realRoadName,
                      zipCode: zipCode,
                      lat: curLat,
                      lon: curLon,
                      verified: true,
                      authDate: Date.now(),
                      expired: false,
                      selected: true,
                    };

                    if (renewIndex > -1 && myLocs[renewIndex])
                      myLocs[renewIndex] = newAuthData;
                    else {
                      myLocs.forEach((loc) => (loc.selected = false));
                      myLocs.push(newAuthData);
                    }

                    await UdongAPI.saveUserLocations("buyer", myLocs);
                    alert("인증이 성공적으로 완료되었습니다!");
                    localStorage.removeItem(ATTEMPT_KEY);
                    localStorage.removeItem(ADDR_ATTEMPT_KEY);
                    location.reload();
                  }
                },
              );
            },
          );
        }
      };

      if (!isAddrMode) {
        document.getElementById("btnAuthRetry").onclick = () => {
          overlay.remove();
          handleFailLock(false);
          window.startGpsAuth(renewIndex);
        };
        document.getElementById("btnAuthToSearch").onclick = () => {
          overlay.remove();
          processPostcodeSearch();
        };
      } else {
        document.getElementById("btnAuthRetrySearch").onclick = () => {
          overlay.remove();
          if (!handleFailLock(true)) processPostcodeSearch();
        };
      }
    };

    if (
      forceAddressSearch ||
      (parseInt(localStorage.getItem(ATTEMPT_KEY)) || 0) >= 3
    ) {
      processPostcodeSearch();
      return;
    }

    try {
      const gpsData = await getBurstGps();
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(gpsData.lon, gpsData.lat, (res, status) => {
        let displayAddr = "위치 확인됨";
        const isRoadState =
          localStorage.getItem(window.getAddrKey()) === "road";

        if (status === kakao.maps.services.Status.OK && res[0]) {
          displayAddr = res[0].address?.address_name || displayAddr;
          if (isRoadState) {
            if (res[0].road_address) {
              displayAddr = res[0].road_address.address_name;
            } else {
              geocoder.coord2RegionCode(
                gpsData.lon,
                gpsData.lat,
                (regionRes, regStatus) => {
                  if (regStatus === kakao.maps.services.Status.OK) {
                    const hRegion =
                      regionRes.find((r) => r.region_type === "H") ||
                      regionRes[0];
                    if (window.roadMappingData) {
                      for (const k in window.roadMappingData) {
                        if (k.endsWith(" " + hRegion.region_3depth_name)) {
                          displayAddr = window.roadMappingData[k][0];
                          break;
                        }
                      }
                    }
                  }
                  showMapModal(gpsData.lat, gpsData.lon, displayAddr, false);
                },
              );
              return;
            }
          }
        }
        showMapModal(gpsData.lat, gpsData.lon, displayAddr, false);
      });
    } catch (e) {
      hideLoading();
      alert(
        "브라우저 위치 API 실패 또는 차단되었습니다.\n(사유: GPS 고장, 권한 거부, VM 사용 등)\n주소 검색창을 띄웁니다.",
      );
      processPostcodeSearch();
    }
  };

  async function selectLocation(selectedIndex) {
    myLocations = myLocations.map((loc, i) => ({
      ...loc,
      selected: i === selectedIndex,
    }));
    await UdongAPI.saveUserLocations("buyer", myLocations);

    await window.updateHeaderLocationUI();
    await renderDropdown();
    window.dispatchEvent(new Event("locationChange"));
    if (locationContainer) locationContainer.classList.remove("active");
  }

  if (locationBtn) {
    locationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      locationContainer.classList.toggle("active");
      if (chatDropdown) chatDropdown.classList.remove("active");
      if (notiDropdown) notiDropdown.classList.remove("active");
      if (userDropdown) userDropdown.classList.remove("active");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      locationContainer &&
      !locationContainer.contains(e.target) &&
      !e.target.closest("#globalAddrToggle")
    )
      locationContainer.classList.remove("active");
    if (chatContainer && !chatContainer.contains(e.target))
      chatDropdown?.classList.remove("active");
    if (notiContainer && !notiContainer.contains(e.target))
      notiDropdown?.classList.remove("active");
    if (userContainer && !userContainer.contains(e.target))
      userDropdown?.classList.remove("active");
  });

  await renderDropdown(); // 초기 로드 (async)
}

async function checkWebRTCLeak() {
  return null;
}

function getBurstGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("API_FAIL"));
    const samples = [];
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy <= 150) samples.push(pos);
      },
      (err) => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
    );
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (samples.length === 0) return reject(new Error("API_FAIL"));
      let sumWeight = 0,
        sumLat = 0,
        sumLon = 0;
      samples.forEach((s) => {
        const w = 1 / s.coords.accuracy;
        sumWeight += w;
        sumLat += s.coords.latitude * w;
        sumLon += s.coords.longitude * w;
      });
      resolve({ lat: sumLat / sumWeight, lon: sumLon / sumWeight });
    }, 3500);
  });
}