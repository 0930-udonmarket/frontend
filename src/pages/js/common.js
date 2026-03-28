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
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    // // (프론트엔드에서 백엔드 서버로 실제 데이터를 요청하는 통신 코드)
    // try {
    //   const token = localStorage.getItem("udong_access_token");
    //   const response = await fetch(`/api/v1/users/locations?role=${role}`, {
    //     headers: { "Authorization": `Bearer ${token}` }
    //   });
    //   if (!response.ok) throw new Error("서버 응답 오류");
    //   return await response.json();
    // } catch (error) {
    //   console.error("위치 정보 로드 실패:", error);
    //   return []; // 에러 발생 시 빈 배열 반환으로 화면 깨짐 방지
    // }
    ============================================= */

    // [핵심 로직] 로컬 스토리지 확인 전, KV 서버에서 최신 인증 정보를 불러오도록 시도
    const key =
      role === "buyer"
        ? "udong_buyer_locations"
        : role === "seller"
          ? "udong_seller_location"
          : "udong_admin_location";

    try {
      const userInfo = JSON.parse(
        localStorage.getItem("udong_user_info") || "{}",
      );
      const nickname = userInfo.nickname || "익명";

      // 로그인이 되어 있다면 서버(KV)에서 데이터 Fetch 시도
      if (localStorage.getItem("udong_is_logged_in") === "true") {
        const res = await fetch(
          `https://udong-bff.wsp485786.workers.dev/api/users/locations?nickname=${encodeURIComponent(nickname)}&role=${role}`,
        );
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            // 인터넷 기록이 삭제되어 비어있더라도 서버 데이터로 로컬 완벽 복구!
            localStorage.setItem(key, JSON.stringify(json.data));
            return json.data;
          }
        }
      }
    } catch (error) {
      console.warn(
        "서버(KV) 위치 정보 로드 실패, 로컬 데이터를 확인합니다:",
        error,
      );
    }

    // 서버에 데이터가 없거나 에러 시 로컬 스토리지(Fallback) 사용
    let data = [];
    try {
      const savedData = localStorage.getItem(key);
      if (savedData) {
        data = JSON.parse(savedData);
      }
    } catch (e) {
      console.warn(`[Data Error] ${key} 파싱 실패. 초기화합니다.`);
      data = [];
    }
    return data;
  },

  // 2. 사용자 위치(동네) 정보 저장하기
  saveUserLocations: async (role, locations) => {
    /* === [나중에 활성화할 실제 API 요청 코드 (에러 방어막 장착 완료!)] ===
    try {
      const token = localStorage.getItem("udong_access_token");
      const response = await fetch(`/api/v1/users/locations?role=${role}`, {
        method: "PUT",
        headers: { 
          "Authorization": `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(locations)
      });

      if (!response.ok) {
        throw new Error(`서버 에러 발생 (상태 코드: ${response.status})`);
      }
      return { success: true };

    } catch (error) {
      console.error("DB 저장 통신 실패:", error);
      alert("서버와 연결이 불안정하여 동네를 저장하지 못했습니다.\n잠시 후 다시 시도해주세요.");
      return { success: false, error: error.message };
    }
    ============================================= */

    // 1. 로컬 스토리지에 즉시 저장 (화면 빠른 반영)
    const key =
      role === "buyer"
        ? "udong_buyer_locations"
        : role === "seller"
          ? "udong_seller_location"
          : "udong_admin_location";
    localStorage.setItem(key, JSON.stringify(locations));

    // 2. [추가] Cloudflare Worker(KV)에 영구 저장 (백그라운드 통신)
    try {
      const userInfo = JSON.parse(
        localStorage.getItem("udong_user_info") || "{}",
      );
      const nickname = userInfo.nickname || "익명";

      await fetch(
        `https://udong-bff.wsp485786.workers.dev/api/users/locations?nickname=${encodeURIComponent(nickname)}&role=${role}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locations),
        },
      );
      console.log("서버(KV)에 위치 정보 동기화 완료!");
    } catch (error) {
      console.warn("서버(KV) 동기화 실패. 로컬 데이터로 작동합니다:", error);
    }

    return { success: true };
  },

  // 3. 사용자 알림 목록 가져오기
  getNotifications: async (role, isVerified) => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const token = localStorage.getItem("udong_access_token");
      const response = await fetch(`/api/v1/notifications`, { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      if (!response.ok) throw new Error("서버 응답 오류");
      return await response.json();
    } catch (error) {
      console.error("알림 목록 로드 실패:", error);
      return [];
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    try {
      const res = await fetch("../../assets/mock_notifications.json");
      const data = await res.json();

      if (role === "seller") return data.seller;
      if (isVerified) return data.buyer_verified;
      return data.buyer_unverified;
    } catch (e) {
      console.warn("알림 Mock 데이터 로드 실패", e);
      return [];
    }
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
  },

  // 4. 사용자 채팅 목록 가져오기
  getChats: async (role, isVerified) => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const token = localStorage.getItem("udong_access_token");
      const response = await fetch(`/api/v1/chats`, { 
        headers: { "Authorization": `Bearer ${token}` } 
      });
      if (!response.ok) throw new Error("서버 응답 오류");
      return await response.json();
    } catch (error) {
      console.error("채팅 목록 로드 실패:", error);
      return [];
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    try {
      const res = await fetch("../../assets/mock_chats.json");
      const data = await res.json();

      if (role === "seller") return data.seller;
      if (isVerified) return data.buyer_verified;
      return data.buyer_unverified;
    } catch (e) {
      console.warn("채팅 Mock 데이터 로드 실패", e);
      return [];
    }
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
  },

  // 5. IP 체크 서버리스 통신
  checkServerlessIP: async () => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const response = await fetch(`/api/v1/auth/ip-check`);
      if (!response.ok) throw new Error("NETWORK_FAIL");
      return await response.json();
    } catch (error) {
      console.error("IP 체크 통신 실패:", error);
      throw error; // IP 체크는 호출부(startGpsAuth)에서 예외 처리를 하므로 에러를 던짐
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    const WORKER_URL = "https://udong-bff.wsp485786.workers.dev/api/ip-check";
    const response = await fetch(WORKER_URL);
    if (!response.ok) throw new Error("NETWORK_FAIL");
    return await response.json();
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
  },

  // -------------------------------------------------------------------------
  // [지역 필터링용 신규 추가 API 모음]
  // 기존의 무거운 regions.json 통째 로딩을 3단계 API 통신으로 쪼갭니다.
  // -------------------------------------------------------------------------

  // 6. 시/도 목록만 가져오기 (1단계)
  getSidoList: async () => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const response = await fetch('/api/v1/regions/sido');
      if (!response.ok) throw new Error("서버 응답 오류");
      return await response.json();
    } catch (error) {
      console.error("시/도 목록 로드 실패:", error);
      return [];
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    return new Promise(async (resolve) => {
      try {
        const res = await fetch("../../assets/regions.json");
        const data = await res.json();
        delete data["시도명"];
        const SIDO_ORDER = [
          "서울",
          "경기",
          "인천",
          "강원",
          "충청북",
          "충청남",
          "대전",
          "세종",
          "전라북",
          "전라남",
          "광주",
          "경상북",
          "경상남",
          "대구",
          "울산",
          "부산",
          "제주",
        ];
        const sidos = Object.keys(data).sort((a, b) => {
          const ia = SIDO_ORDER.findIndex(
            (order) =>
              a.includes(order) || (order === "전라북" && a.includes("전북")),
          );
          const ib = SIDO_ORDER.findIndex(
            (order) =>
              b.includes(order) || (order === "전라북" && b.includes("전북")),
          );
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        setTimeout(() => resolve(sidos), 30);
      } catch (e) {
        resolve([]);
      }
    });
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
  },

  // 7. 특정 시/도의 시/군/구 목록 가져오기 (2단계)
  getSigunguList: async (sido) => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const response = await fetch(`/api/v1/regions/sigungu?sido=${encodeURIComponent(sido)}`);
      if (!response.ok) throw new Error("서버 응답 오류");
      return await response.json();
    } catch (error) {
      console.error("시/군/구 목록 로드 실패:", error);
      return [];
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    return new Promise(async (resolve) => {
      try {
        const res = await fetch("../../assets/regions.json");
        const data = await res.json();
        const sigungus = Object.keys(data[sido]).sort((a, b) =>
          a.localeCompare(b, "ko"),
        );
        setTimeout(() => resolve(sigungus), 30);
      } catch (e) {
        resolve([]);
      }
    });
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
  },

  // 8. 특정 시/군/구의 동 목록 가져오기 (3단계)
  getDongList: async (sido, sigungu) => {
    /* === [나중에 활성화할 실제 API 요청 코드] ===
    try {
      const response = await fetch(`/api/v1/regions/dong?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`);
      if (!response.ok) throw new Error("서버 응답 오류");
      return await response.json();
    } catch (error) {
      console.error("동 목록 로드 실패:", error);
      return [];
    }
    ============================================= */

    // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
    return new Promise(async (resolve) => {
      try {
        const res = await fetch("../../assets/regions.json");
        const data = await res.json();
        const dongs = data[sido][sigungu].sort((a, b) =>
          a.localeCompare(b, "ko"),
        );
        setTimeout(() => resolve(dongs), 30);
      } catch (e) {
        resolve([]);
      }
    });
    // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
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

// ★ 판매자/관리자 도로명 변환 기능 복구 + 지역명 임의 조합 방지 안전장치 추가
window.getMatchedRoadName = function (fullPath) {
  if (!fullPath || fullPath === "전체 지역" || fullPath === "동네 인증")
    return fullPath;
  if (fullPath.endsWith("로") || fullPath.endsWith("길")) return fullPath;

  if (window.roadMappingData) {
    const cleanStr = fullPath.replace(/>/g, " ").replace(/\s+/g, " ").trim();
    const parts = cleanStr.split(" ");
    const dong = parts[parts.length - 1]; // 예: 시흥3동
    let sido = parts.length > 1 ? parts[0] : "";
    let sigungu = parts.length > 2 ? parts[1] : "";

    // ★ 핵심 안전장치: "시흥3동"처럼 동만 넘어오면 엉뚱한 곳을 뒤지지 않도록 상위 지역을 자동 추론
    if (!sido || !sigungu) {
      const upper = window.getUpperRegion(dong); // "서울특별시 금천구" 반환
      const upperParts = upper.split(" ");
      if (upperParts.length >= 2) {
        sido = upperParts[0];
        sigungu = upperParts[1];
      }
    }

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
      // 위에서 추론을 거쳤음에도 못 찾은 최후의 경우에만 부분 검색
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
    const locs = await UdongAPI.getUserLocations(userRole);
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
  try {
    return JSON.parse(localStorage.getItem("udong_user_info"));
  } catch (e) {
    console.warn("사용자 정보 파싱 실패");
    return { nickname: "익명" };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("udong_is_logged_in") === null) {
    localStorage.setItem("udong_is_logged_in", "false");
    localStorage.removeItem("udong_user_role");
  }

  // 👇👇👇 [백엔드 연동 시 완전 삭제해야 할 프론트엔드 DB 초기화 로직] 👇👇👇
  // (백엔드 연동 시, 유저의 기본 지역은 서버에서 응답받아야 하므로 프론트에서 임의 생성하지 않습니다)
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
  // 👆👆👆 여기까지 👆👆👆

  if (!localStorage.getItem("udong_addr_type"))
    localStorage.setItem("udong_addr_type", "dong");

  window.loadRoadData(async () => {
    try {
      await injectHeader();
      injectFooter();
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

  if (isLoggedIn) {
    try {
      const savedLocs = await UdongAPI.getUserLocations(userRole);
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
    const myNickname = myInfo.nickname;

    if (userRole === "seller") {
      rightMenuHTML = `
        <div class="header-action-item" id="chatMenuContainer"><span class="header-action">채팅</span><span class="badge" id="chatBadge" style="display: none;">0</span><div class="action-dropdown" id="chatDropdown"><ul class="dropdown-list" id="chatList"></ul></div></div>
        <div class="header-action-item" id="notiMenuContainer"><span class="header-action">알림</span><span class="badge" id="notiBadge" style="display: none;">0</span><div class="action-dropdown" id="notiDropdown"><ul class="dropdown-list" id="notiList"></ul></div></div>
        <div class="header-action-item user-dropdown-container" id="userMenuContainer"><span class="header-action user-nickname" title="${myInfo.nickname}">${myInfo.nickname}님</span><div class="action-dropdown" id="userMenuDropdown"><ul class="dropdown-list"><li class="user-menu-item" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); location.reload();">로그아웃</li></ul></div></div>
        <a href="/pages/mypage/seller.html" class="btn-partner" onclick="alert('판매자 마이페이지로 이동합니다.'); return false;">파트너 센터</a>
      `;
    } else if (userRole === "admin") {
      rightMenuHTML = `
        <span class="header-action" style="color:var(--admin-red); font-weight:800;">ADMIN</span>
        <a href="#" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); location.reload();" class="header-action">로그아웃</a>
        <a href="/pages/mypage/admin.html" class="btn-admin-center" onclick="alert('관리자 마이페이지로 이동합니다.'); return false;">관리자 센터</a>
      `;
    } else {
      let chatMenuHTML = "";
      if (isBuyerVerified) {
        chatMenuHTML = `<div class="header-action-item" id="chatMenuContainer"><span class="header-action">채팅</span><span class="badge" id="chatBadge" style="display: none;">0</span><div class="action-dropdown" id="chatDropdown"><ul class="dropdown-list" id="chatList"></ul></div></div>`;
      }
      rightMenuHTML = `
        ${chatMenuHTML}
        <div class="header-action-item" id="notiMenuContainer"><span class="header-action">알림</span><span class="badge" id="notiBadge" style="display: none;">0</span><div class="action-dropdown" id="notiDropdown"><ul class="dropdown-list" id="notiList"></ul></div></div>
        <div class="header-action-item user-dropdown-container" id="userMenuContainer"><span class="header-action user-nickname" title="${myInfo.nickname}">${myInfo.nickname}님</span><div class="action-dropdown" id="userMenuDropdown"><ul class="dropdown-list"><li class="user-menu-item" onclick="location.href='/src/pages/mypage/home.html'">마이페이지</li><li class="user-menu-item" onclick="localStorage.setItem('udong_is_logged_in','false'); localStorage.removeItem('udong_user_role'); localStorage.removeItem('udong_user_info'); location.reload();">로그아웃</li></ul></div></div>
        <a href="#" id="btnOpenGroup" class="btn-open-group">공구 열기</a>
      `;
    }
  } else {
    rightMenuHTML = `
      <a href="/src/pages/Login.html" class="header-action btn-login-text">로그인/회원가입</a>
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
      ? window.getUpperRegion(initialLocation)
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
      // [대청소] 로컬스토리지 대신 Worker API를 통해 서버에 설정값 저장
      const newType = isChecked ? "road" : "dong";

      // 🚀 [여기에 한 줄 추가] 닉네임을 여기서 다시 안전하게 불러와야 합니다!
      const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;

      localStorage.setItem(window.getAddrKey(), newType); // 즉시 반영용 (유지)
      fetch(
        `https://udong-bff.wsp485786.workers.dev/api/users/preferences/address-type?nickname=${encodeURIComponent(myNickname)}&role=${userRole}`,
        {
          method: "PUT",
          body: JSON.stringify({ addressType: newType }),
        },
      );
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
    myLocations = await UdongAPI.getUserLocations(userRole);
  } catch (e) {
    myLocations = [];
  }

  // 데이터 로드를 위해 async로 변경
  window.addEventListener("addrTypeChange", async () => {
    if (typeof renderDropdown === "function") await renderDropdown();
  });

  if (userRole === "buyer") {
    // ★ 백엔드 연동 후에도 유지해야 할 UI 로직 (만료 알림창 띄우기)
    const hasExpired = myLocations.some((loc) => loc.expired === true);
    if (hasExpired) {
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
            location.href = "/src/pages/Login.html";
        } else if (userRole === "buyer") {
          alert("📢 유효한 동네 인증을 완료해야 공구를 열 수 있습니다!");
        }
        return;
      }
      // ✨ 페이지 이동 대신 모달 팝업 호출
      window.openRequestModal();
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
        <button onclick="location.href='/src/pages/Login.html'" style="width:100%; margin-top:5px; background:#f1f3f5; border:none; padding:8px; border-radius:4px; font-weight:700; cursor:pointer; color:#495057;">로그인하기</button>
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
      currentMyLocations = await UdongAPI.getUserLocations(userRole);
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
        li.onclick = async () => {
          await UdongAPI.markAsRead(type, item.id);
          alert(
            `${type === "chat" ? "채팅방" : "해당 페이지"}으로 이동합니다.`,
          );
          // 실제 연동 시에는 페이지 이동을 시키겠지만, 현재는 가짜 로직이므로 새로고침으로 '읽음' 반영 확인
          location.reload();
        };
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

  // 주변 반경 100m 이내의 시설물을 탐색해 진짜 도로명을 찾아내는 헬퍼 함수
  window.getNearbyRoadNameAsync = function (lat, lon) {
    return new Promise((resolve) => {
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        resolve("");
        return;
      }
      const ps = new kakao.maps.services.Places();
      // 주변 도로명을 찾기 좋은 카테고리 (지하철역, 공공기관, 편의점, 음식점, 카페 등)
      const categories = [
        "SW8",
        "PO3",
        "CS2",
        "FD6",
        "CE7",
        "CT1",
        "MT1",
        "PK6",
      ];
      let catIndex = 0;

      const searchNext = () => {
        if (catIndex >= categories.length) {
          resolve("");
          return;
        }
        ps.categorySearch(
          categories[catIndex],
          (data, status) => {
            if (status === kakao.maps.services.Status.OK && data.length > 0) {
              for (let i = 0; i < data.length; i++) {
                if (data[i].road_address_name) {
                  // 건물 번호(-\d+)를 제외하고 순수 도로명(예: 경수대로, 시흥대로2길)만 추출
                  const match =
                    data[i].road_address_name.match(/\S+(?:로|길|대로)/);
                  if (match) {
                    resolve(match[0]);
                    return;
                  }
                }
              }
            }
            catIndex++;
            searchNext();
          },
          {
            location: new kakao.maps.LatLng(lat, lon),
            radius: 100, // 100m 이내만 탐색
            sort: kakao.maps.services.SortBy.DISTANCE,
          },
        );
      };
      searchNext();
    });
  };

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

      const overlay = document.createElement("div");
      overlay.className = "auth-modal-overlay";
      overlay.innerHTML = `
        <div class="auth-modal-box" style="height: 550px; display: flex; flex-direction: column; width: 500px; padding: 30px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; font-size: 22px; color: #212529;">🔍 장소 및 주소 검색</h3>
            <button class="btn-modal-close" onclick="this.closest('.auth-modal-overlay').remove()">✕</button>
          </div>
          <div style="display:flex; gap:10px; margin-bottom:15px; background: #f8f9fa; padding: 8px 12px; border-radius: 12px; border: 1px solid #dee2e6; transition: border 0.2s;">
            <span style="font-size: 20px; color: #adb5bd; display:flex; align-items:center; padding-left: 5px;">📍</span>
            <input type="text" id="placeSearchInput" style="flex:1; border:none; background:transparent; outline:none; font-size:15px; color:#495057;" placeholder="동네명, 상호명, 도로명 주소를 입력하세요" autocomplete="off">
            <button id="btnPlaceSearch" style="padding:10px 24px; background:var(--text-dark); color:white; border:none; border-radius:8px; font-weight:800; font-size:14px; white-space:nowrap; cursor:pointer; transition:0.2s;">검색</button>
          </div>
          <ul id="placeResultList" style="flex:1; overflow-y:auto; list-style:none; padding:0; margin:0; border:1px solid #eee; border-radius:12px; background:white;">
            <li style="padding:50px 20px; text-align:center; color:#868e96; display:flex; flex-direction:column; gap:12px;">
              <span style="font-size:36px; margin-bottom:5px;">💡</span>
              <span style="font-weight:800; color:#343a40; font-size:16px;">이렇게 검색해 보세요!</span>
              <span style="font-size:14px; color:#adb5bd; line-height:1.5;">강남역<br>테헤란로 152<br>스타벅스 삼성점</span>
            </li>
          </ul>
        </div>
      `;
      document.body.appendChild(overlay);

      const searchInput = document.getElementById("placeSearchInput");
      const searchBtn = document.getElementById("btnPlaceSearch");
      const resultList = document.getElementById("placeResultList");

      searchInput.addEventListener(
        "focus",
        () => (searchInput.parentElement.style.borderColor = "#ff6f0f"),
      );
      searchInput.addEventListener(
        "blur",
        () => (searchInput.parentElement.style.borderColor = "#dee2e6"),
      );

      const executeSearch = () => {
        const keyword = searchInput.value.trim();
        if (!keyword) return alert("검색어를 입력해주세요.");

        searchBtn.innerText = "검색중..";
        searchBtn.style.opacity = "0.7";

        try {
          if (
            !window.kakao ||
            !window.kakao.maps ||
            !window.kakao.maps.services
          ) {
            throw new Error("카카오 장소 검색 API 누락");
          }
          const ps = new kakao.maps.services.Places();
          ps.keywordSearch(keyword, (data, status) => {
            searchBtn.innerText = "검색";
            searchBtn.style.opacity = "1";

            if (status === kakao.maps.services.Status.OK) {
              resultList.innerHTML = "";
              data.forEach((place) => {
                const li = document.createElement("li");
                li.style.cssText =
                  "padding:16px 20px; border-bottom:1px solid #f1f3f5; cursor:pointer; background:white; transition:0.2s;";
                li.onmouseenter = () => (li.style.background = "#f8f9fa");
                li.onmouseleave = () => (li.style.background = "white");
                li.innerHTML = `
                  <div style="font-weight:800; font-size:15px; color:#212529; margin-bottom:4px;">${place.place_name}</div>
                  <div style="font-size:13px; color:#868e96;">${place.road_address_name || place.address_name}</div>
                `;
                li.onclick = () => {
                  overlay.remove();
                  showMapModal(
                    parseFloat(place.y),
                    parseFloat(place.x),
                    place.road_address_name ||
                      place.address_name ||
                      place.place_name,
                    true,
                  );
                };
                resultList.appendChild(li);
              });
            } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
              resultList.innerHTML = `<li style="padding:40px 20px; text-align:center; color:#868e96; font-size:14px;">검색 결과가 없습니다.<br>다른 검색어로 시도해보세요.</li>`;
            } else {
              resultList.innerHTML = `<li style="padding:40px 20px; text-align:center; color:#fa5252; font-size:14px;">검색 중 오류가 발생했습니다.</li>`;
            }
          });
        } catch (error) {
          console.error(error);
          searchBtn.innerText = "검색";
          searchBtn.style.opacity = "1";
          alert("네트워크 차단으로 카카오 장소 검색 API를 불러올 수 없습니다.");
        }
      };

      searchBtn.onclick = executeSearch;
      searchInput.onkeydown = (e) => {
        if (e.key === "Enter") executeSearch();
      };
      searchInput.focus();
    };

    const showMapModal = (lat, lon, address, isAddrMode) => {
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

      try {
        if (
          !window.kakao ||
          !window.kakao.maps ||
          !window.kakao.maps.services
        ) {
          throw new Error("카카오맵 미로드");
        }

        const map = new kakao.maps.Map(
          document.getElementById("authKakaoMap"),
          {
            center: new kakao.maps.LatLng(lat, lon),
            level: 3,
          },
        );
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
          const btnConfirm = document.getElementById("btnAuthConfirm");
          btnConfirm.disabled = true;

          geocoder.coord2RegionCode(curLon, curLat, (regRes, regStatus) => {
            geocoder.coord2Address(
              curLon,
              curLat,
              async (addrRes, addrStatus) => {
                if (regStatus === kakao.maps.services.Status.OK) {
                  const hRegion =
                    regRes.find((x) => x.region_type === "H") || regRes[0];
                  const isRoadState =
                    localStorage.getItem(window.getAddrKey()) === "road";
                  let displayAddr = hRegion.region_3depth_name;

                  let preciseRoadForDB = "";

                  if (
                    addrStatus === kakao.maps.services.Status.OK &&
                    addrRes[0] &&
                    addrRes[0].road_address
                  ) {
                    preciseRoadForDB = addrRes[0].road_address.road_name;
                    if (isRoadState) displayAddr = preciseRoadForDB;

                    document.getElementById("modalAddrDisplay").innerText =
                      displayAddr;
                    document.getElementById(
                      "modalAddrDisplay",
                    ).dataset.preciseRoad = preciseRoadForDB;
                    btnConfirm.disabled = false;
                  } else {
                    if (isRoadState)
                      document.getElementById("modalAddrDisplay").innerText =
                        "주변 도로명 탐색 중...";

                    const nearbyRoad = await window.getNearbyRoadNameAsync(
                      curLat,
                      curLon,
                    );
                    preciseRoadForDB = nearbyRoad || "";

                    if (isRoadState) {
                      displayAddr =
                        preciseRoadForDB || hRegion.region_3depth_name;
                      document.getElementById("modalAddrDisplay").innerText =
                        displayAddr;
                    } else {
                      document.getElementById("modalAddrDisplay").innerText =
                        displayAddr;
                    }
                    document.getElementById(
                      "modalAddrDisplay",
                    ).dataset.preciseRoad = preciseRoadForDB;
                    btnConfirm.disabled = false;
                  }
                }
              },
            );
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

                      let realRoadName =
                        document.getElementById("modalAddrDisplay").dataset
                          .preciseRoad || "";

                      if (
                        !document
                          .getElementById("modalAddrDisplay")
                          .hasAttribute("data-precise-road")
                      ) {
                        if (
                          addrStatus === kakao.maps.services.Status.OK &&
                          addrResult[0] &&
                          addrResult[0].road_address
                        ) {
                          realRoadName = addrResult[0].road_address.road_name;
                        } else {
                          realRoadName = await window.getNearbyRoadNameAsync(
                            curLat,
                            curLon,
                          );
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
                        dong: hRegion.region_3depth_name,
                        roadName: realRoadName,
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
      } catch (error) {
        console.error("카카오맵 렌더링 실패:", error);
        document.getElementById("authKakaoMap").innerHTML =
          `<div style="height:100%; display:flex; justify-content:center; align-items:center; color:#fa5252; font-size:13px; text-align:center; padding:20px; background:#f8f9fa;">지도 서비스를 사용할 수 없습니다.<br>네트워크 상태나 확장프로그램(광고차단)을 확인해주세요.</div>`;
        document.getElementById("btnAuthConfirm").disabled = true;
      }

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
      // GPS 호출 성공 시 카카오맵 유무에 따라 분기
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        showMapModal(gpsData.lat, gpsData.lon, "위치 확인됨", false);
        return;
      }

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

// ==========================================================================
// [추가된 API 추상화 계층 - 백엔드 전환용 (찜, 최근본, 삭제)]
// ==========================================================================

// 9. 관심 상품(찜) 토글 API (KV 영구 저장소 연동 완료)
UdongAPI.toggleWishlist = async (itemData) => {
  // [대청소 완료] 메인 화면에서도 로컬스토리지 찜하기 로직 완전 삭제 후 백엔드 API 직접 호출
  try {
    const myInfo = JSON.parse(localStorage.getItem("udong_user_info") || "{}");
    const myNickname = myInfo.nickname || "익명";

    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/users/wishlist?nickname=${encodeURIComponent(myNickname)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: itemData.id }),
      },
    );

    if (!response.ok) throw new Error("찜하기 통신 실패");
    return await response.json(); // { success: true, isAdded: true/false } 반환
  } catch (e) {
    console.error("찜하기 에러:", e);
    return null;
  }
};

// 10. 최근 본 공구 기록 저장 API (수정본)
UdongAPI.saveRecentItem = async (role, itemData) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/users/recent`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role, item: itemData })
    });
    if (!response.ok) throw new Error(`서버 에러: ${response.status}`);
    return true;
  } catch (error) {
    console.error("최근 본 공구 저장 통신 실패:", error);
    return false;
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/recent?role=${role}&nickname=${encodeURIComponent(myNickname)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemData }),
      },
    );
    if (!response.ok) throw new Error("BFF 통신 실패");
    return true;
  } catch (error) {
    console.error("최근 본 공구 저장 통신 실패:", error);
    return false;
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 11. 관리자 게시글 삭제 API (작성자 닉네임 파라미터 추가)
UdongAPI.deletePost = async (postId, reason, authorNickname) => {
  // [대청소 완료] 작성자 닉네임(authorNickname)을 서버로 전달하여 서버가 KV 알림을 생성할 수 있도록 수정
  try {
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/admin/posts/${postId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        // body에 authorNickname을 포함하여 서버로 전송
        body: JSON.stringify({ reason, authorNickname }),
      },
    );
    if (!response.ok) throw new Error("BFF 삭제 통신 실패");

    const data = await response.json();
    return data.success;
  } catch (e) {
    console.error("BFF 통신 에러:", e);
    return false;
  }
};

// 12. 회원 제재(Ban) 실행 API
UdongAPI.sanctionUser = async (nickname, reason, level) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/admin/sanctions`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, reason, level })
    });
    return response.ok;
  } catch (error) {
    console.error("제재 API 통신 에러:", error);
    return false;
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/admin/sanctions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, reason, level }),
      },
    );
    if (!response.ok) throw new Error("BFF 제재 통신 실패");

    const data = await response.json();
    return data.success;
  } catch (e) {
    console.error("BFF 통신 에러:", e);
    return false;
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 13. 알림/채팅 읽음 확인(Mark as Read) API
UdongAPI.markAsRead = async (type, itemId) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    await fetch(`https://api.udongmarket.com/v1/notifications/${itemId}/read`, {
      method: 'PUT',
      headers: { "Authorization": `Bearer ${token}` }
    });
    return true;
  } catch (error) { return false; }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
  return new Promise((resolve) => setTimeout(() => resolve(true), 100));
  // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
};

// ============================================================================
// [공구 요청 & 입찰 제안 API 통신 추상화 계층 - 백엔드 전환용]
// ============================================================================

// 1. 공구 요청 등록 (구매자)
UdongAPI.createRequest = async (requestData) => {
  /* === [실제 백엔드 API 연동 코드 (공구 요청 생성)] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch('https://api.udongmarket.com/v1/requests', {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "서버 응답 오류");
    }
    return await response.json();
  } catch (error) {
    console.error("공구 요청 작성 실패:", error);
    alert("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return null;
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 삭제되어야 할 가짜 로직 (BFF 통신 + 화면 업데이트용)] 👇👇👇
  try {
    // ★ 핵심 수정: Cloudflare Worker(Mock DB)가 상세 페이지 조회 시 이 글을 찾아 한글 변환(BFF 역할)을 수행할 수 있도록,
    // 프론트엔드에서 ID가 포함된 완전한 객체를 먼저 조립하여 Worker로 전송합니다.
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    const newReq = {
      id: `req_new_${Date.now()}`,
      title: requestData.title,
      desc: requestData.desc,
      budget: parseInt(requestData.budget).toLocaleString() + "원",
      category: requestData.category,
      estimatedParticipants: requestData.estimatedParticipants,
      deadline: requestData.deadline,
      receiveMethod: requestData.receiveMethod,
      link: requestData.link,
      timestamp: timestamp,
      location: requestData.location,
      roadAddr: requestData.roadAddr,
      // ★ [수정] 누락되었던 배달부 역할 복구: Worker가 주소를 똑똑하게 가공할 수 있도록 원본 텍스트를 그대로 넘김
      rawFullAddress: requestData.rawFullAddress || "",
      lat: requestData.lat,
      lon: requestData.lon,
      author: requestData.author,
      myRole: "host",
      biddingSellers: 0,
    };

    // 1. CF Worker(BFF)로 통신 (ID가 포함된 완전한 객체 전송)
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReq),
      },
    );

    if (!response.ok) throw new Error("BFF 요청 등록 통신 실패");
    const data = await response.json();

    // 2. Worker에서 정상 처리되었다면 성공 결과만 반환 (로컬 스토리지 임시 저장 로직 완전 삭제)
    if (data.success) {
      return newReq;
    }
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
  // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
};

// 2. 입찰 제안 등록 (판매자)
UdongAPI.submitBid = async (reqId, bidData) => {
  /* === [실제 백엔드 API 연동 코드 (입찰 제안 생성)] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/requests/${reqId}/bids`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(bidData) 
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "서버 응답 오류");
    }
    return await response.json();
  } catch (error) {
    console.error("입찰 제안 실패:", error);
    alert("입찰 처리 중 오류가 발생했습니다.");
    return null;
  }
  ============================================================== */

  // [대청소 완료] 로컬 스토리지 의존 완전 삭제, 백엔드(Worker) 영구 저장소에 입찰 기록 위임
  try {
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/requests/${reqId}/bids?nickname=${encodeURIComponent(myNickname)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bidData),
      },
    );

    if (!response.ok) throw new Error("BFF 입찰 등록 통신 실패");
    const data = await response.json();

    if (data.success) return { success: true };
    return null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

// 3. 공통 팝업 스타일 (누락 복구 - 팝업 안 열리는 원인 해결)
function injectModalStyles() {
  if (document.getElementById("udong-modal-styles")) return;
  const style = document.createElement("style");
  style.id = "udong-modal-styles";
  style.innerHTML = `
    .udong-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 100000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.2s; }
    .udong-modal-overlay.show { opacity: 1; }
    .udong-modal-box { background: white; width: 600px; max-width: 95%; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transform: translateY(20px); transition: transform 0.2s; display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
    .udong-modal-header { position: sticky; top: 0; background: white; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 16px; border-bottom: 2px solid #f1f3f5; }
    .udong-modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .udong-modal-footer { position: sticky; bottom: 0; background: white; z-index: 10; display: flex; gap: 10px; padding: 16px 24px; border-top: 1px solid #f1f3f5; }
    .udong-modal-title { font-size: 18px; font-weight: 800; color: var(--text-dark); margin: 0; }
    .btn-modal-close { font-size: 20px; color: #adb5bd; background: none; border: none; cursor: pointer; }
    .btn-modal-close:hover { color: #495057; }
    .udong-form-group { margin-bottom: 16px; }
    .udong-form-label { display: block; font-size: 13px; font-weight: 700; color: #495057; margin-bottom: 6px; }
    .udong-form-input { width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; outline: none; transition: 0.2s; font-family: inherit; }
    .udong-form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(255,111,15,0.1); }
    textarea.udong-form-input { resize: vertical; min-height: 100px; }
    .btn-modal-submit, .btn-modal-cancel { flex: 1; padding: 14px; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: 0.2s; }
    .btn-modal-submit { background: var(--primary); color: white; }
    .btn-modal-submit:hover { background: #e8590c; }
    .btn-modal-submit.seller { background: var(--seller-blue); }
    .btn-modal-submit.seller:hover { background: #3b5bdb; }
    .btn-modal-cancel { background: #f1f3f5; color: #495057; }
    .btn-modal-cancel:hover { background: #e9ecef; }
  `;
  document.head.appendChild(style);
}

window.udongDummyReqIndex = window.udongDummyReqIndex || 0;
window.udongDummyBidIndex = window.udongDummyBidIndex || 0;

window.openRequestModal = async function () {
  // [완벽 방어] 이미 화면에 열려있는 모달(오버레이)이 있다면 중복 실행 방지
  if (document.querySelector(".udong-modal-overlay")) return;

  injectModalStyles();
  let myInfo = { nickname: "익명" };
  try {
    const savedInfo = localStorage.getItem("udong_user_info");
    if (savedInfo) myInfo = JSON.parse(savedInfo);
  } catch (e) {
    console.warn("사용자 정보 파싱 실패");
  }
  const buyerLocs = await UdongAPI.getUserLocations("buyer");
  const selectedLoc = buyerLocs.find((l) => l.selected);

  if (!selectedLoc || !selectedLoc.verified || selectedLoc.expired) {
    alert("동네 인증이 완료된 사용자만 공구를 요청할 수 있습니다.");
    return;
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  maxDate.setMinutes(maxDate.getMinutes() - maxDate.getTimezoneOffset());
  const maxDateTime = maxDate.toISOString().slice(0, 16);

  // [수정] 팝업 초기 로드 시 헤더의 도로명 스위치 상태 확인 및 연동
  const isRoadState = localStorage.getItem(window.getAddrKey()) === "road";
  let defaultLocName = "";

  if (isRoadState) {
    defaultLocName =
      selectedLoc.roadName ||
      (selectedLoc.name.includes(">")
        ? selectedLoc.name.split(">").pop().trim()
        : selectedLoc.name);
  } else {
    defaultLocName =
      selectedLoc.dong ||
      (selectedLoc.name.includes(">")
        ? selectedLoc.name.split(">").pop().trim()
        : selectedLoc.name);
  }

  let defaultLat = selectedLoc.lat || 37.4979;
  let defaultLon = selectedLoc.lon || 127.0276;

  let currentCleanDong =
    selectedLoc.dong ||
    (selectedLoc.name.includes(">")
      ? selectedLoc.name.split(">").pop().trim()
      : selectedLoc.name);
  let currentCleanRoad = selectedLoc.roadName || "";

  let radiusLimit = 5000;
  const upper = window.getUpperRegion(selectedLoc.name);
  if (
    ["서울", "경기", "부산", "인천", "대구", "대전", "광주"].some((u) =>
      upper.includes(u),
    )
  ) {
    radiusLimit = 3000;
  }

  const overlay = document.createElement("div");
  overlay.className = "udong-modal-overlay";
  overlay.innerHTML = `
      <div class="udong-modal-box">
        <div class="udong-modal-header">
          <h3 class="udong-modal-title">📢 판매자에게 공구 요청하기</h3>
          <button class="btn-modal-close" onclick="this.closest('.udong-modal-overlay').remove()">✕</button>
        </div>
        <div class="udong-modal-body">
          <button type="button" id="btnDummyRequest" style="font-size:12px; padding:6px 12px; background:#f1f3f5; color:#495057; border:none; border-radius:6px; margin-bottom:15px; cursor:pointer; font-weight:700;">🧪 빠른 자동 입력 (누를 때마다 변경)</button>
          
          <div class="udong-form-group">
            <label class="udong-form-label">1. 제목</label>
            <input type="text" id="reqTitle" class="udong-form-input" placeholder="어떤 물품을 함께 사고 싶나요?" autocomplete="off">
          </div>
          <div style="display:flex; gap:10px;">
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">2. 카테고리</label>
              <select id="reqCategory" class="udong-form-input">
                <option value="food">🍎 식품/농산물</option>
                <option value="living">🧻 생활/주방</option>
                <option value="others" selected>🎸 기타</option>
              </select>
            </div>
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">3. 1인당 희망 가격 (원)</label>
              <input type="number" id="reqBudget" class="udong-form-input" placeholder="예: 15000" step="100" min="0">
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">4. 예상 필요 인원 (선택)</label>
              <input type="number" id="reqParticipants" class="udong-form-input" placeholder="예: 5">
            </div>
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">5. 판매자 제안 마감일 (최대 7일)</label>
              <input type="datetime-local" id="reqDeadline" class="udong-form-input" min="${minDateTime}" max="${maxDateTime}">
            </div>
          </div>
          <div class="udong-form-group">
            <label class="udong-form-label">6. 거래 희망 장소 (내 동네 반경 ${radiusLimit / 1000}km 이내)</label>
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:8px;">
              <label style="font-size:13px; display:flex; align-items:center; gap:4px;"><input type="radio" name="locType" value="auth" checked> 내 동네 (인증위치)</label>
              <label style="font-size:13px; display:flex; align-items:center; gap:4px;"><input type="radio" name="locType" value="custom"> 직접 장소 검색</label>
            </div>
            
            <div style="position:relative; margin-bottom:8px;">
              <div style="display:flex; gap:8px;">
                <input type="text" id="reqCustomLoc" class="udong-form-input" readonly placeholder="장소명, 건물명, 상호명을 검색하세요" value="${defaultLocName}">
                <button id="btnReqLocSearch" style="display:none; padding:0 16px; background:#495057; color:white; border:none; border-radius:8px; font-weight:bold; white-space:nowrap; cursor:pointer;">검색</button>
              </div>
              <ul id="reqLocResultList" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:white; border:1px solid #dee2e6; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:1000; list-style:none; padding:0; margin-top:4px;"></ul>
            </div>
            <div id="reqKakaoMap" style="width:100%; height:180px; border-radius:8px; border:1px solid #dee2e6; margin-bottom:8px; background:#f8f9fa;"></div>
          </div>
          <div style="display:flex; gap:10px;">
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">7. 수령 희망 방식</label>
              <select id="reqReceive" class="udong-form-input">
                <option value="delivery_group">지정 장소 일괄 배송</option>
                <option value="delivery_direct">판매자에게 직접 전달받기</option>
              </select>
            </div>
            <div class="udong-form-group" style="flex:1;">
              <label class="udong-form-label">8. 참고 상품 링크 (선택)</label>
              <input type="url" id="reqLink" class="udong-form-input" placeholder="http://...">
            </div>
          </div>
          <div class="udong-form-group">
            <label class="udong-form-label">9. 상세 설명</label>
            <textarea id="reqDesc" class="udong-form-input" placeholder="원하는 수량, 품질 등 판매자가 참고할 내용을 구체적으로 적어주세요."></textarea>
          </div>
        </div>
        <div class="udong-modal-footer">
          <button class="btn-modal-cancel" onclick="this.closest('.udong-modal-overlay').remove()">취소</button>
          <button class="btn-modal-submit" id="btnSubmitRequest">요청 등록</button>
        </div>
      </div>
    `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  // 🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️
  // 👇👇👇 [삭제 전용 코드 구역 시작] 실제 백엔드 연동 및 상용화 시 통째로 삭제하세요 👇👇👇
  // (기능: 데모 시연을 위해 공구 요청 팝업의 내용을 랜덤으로 채워주는 매크로 버튼 동작)
  const mMods = [
    "신선한",
    "유기농",
    "무농약",
    "산지직송",
    "B급",
    "당일수확",
    "프리미엄",
    "갓성비",
    "대용량",
    "업소용",
    "자취생용",
    "국내산",
    "수입산",
    "자연산",
    "무항생제",
  ];
  const mBrands = [
    "청송",
    "제주",
    "나주",
    "해남",
    "상주",
    "이천",
    "횡성",
    "지리산",
    "보성",
    "종가집",
    "곰곰",
    "비비고",
    "동원",
    "오뚜기",
    "노브랜드",
  ];
  const mProds = [
    "사과",
    "감귤",
    "배",
    "고구마",
    "곶감",
    "쌀",
    "한우",
    "흑돼지",
    "녹차",
    "김치",
    "생수",
    "탄산수",
    "만두",
    "참치",
    "휴지",
    "물티슈",
    "주방세제",
    "샴푸",
  ];
  const mUnits = [
    "10kg",
    "5kg",
    "3kg",
    "1박스",
    "30롤",
    "100매",
    "2L x 12병",
    "500ml x 20병",
    "대용량 리필",
    "소분용 팩",
  ];

  document.getElementById("btnDummyRequest").onclick = () => {
    // [요구사항 반영] 판매자에게 요청하는 맥락에 맞는 템플릿 기반 무한 랜덤 생성 & \n 버그 수정
    const templates = [
      {
        prod: "생수/탄산수",
        category: "food",
        mods: ["식당용", "사무실용", "행사용"],
        units: ["100병", "50팩", "20박스"],
        brands: ["삼다수", "코카콜라", "트레비", "스파클"],
        desc: "사무실/업장에서 사용할 {brand} {prod} 대량 구매 원합니다.\n정기 납품 가능하신 도매상이나 마트 사장님 견적 부탁드립니다.",
      },
      {
        prod: "A4용지",
        category: "living",
        mods: ["사무실용", "학원용", "대량"],
        units: ["10박스", "50권", "100권"],
        brands: ["더블에이", "밀크", "한솔"],
        desc: "학원에서 사용할 {brand} {prod} {unit} 한 번에 주문하려고 합니다.\n저렴하게 납품해주실 문구점이나 도매처 사장님 연락 기다립니다.",
      },
      {
        prod: "종이컵",
        category: "living",
        mods: ["카페용", "사무실용", "업소용"],
        units: ["10000개", "5000개", "10박스"],
        brands: ["친환경", "무지", "크라프트"],
        desc: "매장에서 쓸 {brand} {prod} {unit} 대량 견적 요청합니다.\n배달 가능하신 유통업체 사장님들의 입찰 부탁드려요.",
      },
      {
        prod: "냉동 삼겹살",
        category: "food",
        mods: ["MT용", "회식용", "행사용"],
        units: ["10kg", "20kg", "50인분"],
        brands: ["국내산", "수입산", "보성녹돈"],
        desc: "대학교 MT 단체 식사용으로 {brand} {prod} {unit} 구매합니다.\n파채나 쌈장 서비스 주실 수 있는 정육점 사장님 환영합니다!",
      },
      {
        prod: "간식/과자 꾸러미",
        category: "food",
        mods: ["어린이집용", "학원용", "행사용"],
        units: ["100세트", "50세트", "대형 10박스"],
        brands: ["오리온", "롯데", "해태"],
        desc: "어린이집 행사 간식 꾸러미를 만들기 위해 {brand} {prod} {unit} 대량 구매 원합니다.\n다양한 종류로 맞춰주실 수 있는 동네 마트 사장님 입찰 부탁드립니다.",
      },
    ];

    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const mod = tpl.mods[Math.floor(Math.random() * tpl.mods.length)];
    const unit = tpl.units[Math.floor(Math.random() * tpl.units.length)];
    const brand = tpl.brands[Math.floor(Math.random() * tpl.brands.length)];

    const title = `[${mod}] ${brand} ${tpl.prod} ${unit} 견적 요청`;
    const price = Math.floor(Math.random() * 50 + 5) * 1000;
    const part = Math.floor(Math.random() * 10) + 2;
    const desc = tpl.desc
      .replace("{brand}", brand)
      .replace("{prod}", tpl.prod)
      .replace("{unit}", unit);

    document.getElementById("reqTitle").value = title;
    document.getElementById("reqCategory").value = tpl.category;
    document.getElementById("reqBudget").value = price;
    document.getElementById("reqParticipants").value = part;
    const d = new Date();
    d.setDate(d.getDate() + Math.floor(Math.random() * 6 + 1));
    document.getElementById("reqDeadline").value = d.toISOString().slice(0, 16);
    document.getElementById("reqDesc").value = desc;
  };
  // 👆👆👆 [삭제 전용 코드 구역 끝] 👆👆👆
  // 🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️

  setTimeout(() => {
    let reqMap, reqMarker, reqGeocoder;
    try {
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
        throw new Error("카카오맵 미로드");
      }
      const mapContainer = document.getElementById("reqKakaoMap");
      reqMap = new kakao.maps.Map(mapContainer, {
        center: new kakao.maps.LatLng(defaultLat, defaultLon),
        level: 3,
      });
      reqMarker = new kakao.maps.Marker({
        position: reqMap.getCenter(),
        draggable: false,
      });
      reqMarker.setMap(reqMap);
      reqGeocoder = new kakao.maps.services.Geocoder();

      // [핵심 수정] 검색한 건물명 강제 덧붙임 완전 삭제 및 지번 주소 중복 방지
      const updateInputToFullAddress = (lat, lon, knownPlaceData = null) => {
        document.getElementById("reqCustomLoc").value = "주소 변환 중...";
        reqGeocoder.coord2RegionCode(lon, lat, (regRes, regStatus) => {
          if (regStatus === kakao.maps.services.Status.OK) {
            const hRegion =
              regRes.find((r) => r.region_type === "H") || regRes[0];
            const bRegion =
              regRes.find((r) => r.region_type === "B") || regRes[0];
            currentCleanDong = hRegion.region_3depth_name; // 예: 시흥3동
            const safeLegalDong = bRegion.region_3depth_name; // 예: 시흥동

            reqGeocoder.coord2Address(lon, lat, async (addrRes, addrStatus) => {
              let roadFull = "";
              let jibunFull = "";
              const SIDO_MAP = {
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

              // 1. 검색 결과 데이터 최우선 적용
              if (knownPlaceData) {
                roadFull = knownPlaceData.road_address_name || "";
                jibunFull = knownPlaceData.address_name || "";
              }

              // 2. 검색 데이터가 없거나 도로명이 비어있는 경우 (길거리나 지하철역 핀)
              if (addrStatus === kakao.maps.services.Status.OK && addrRes[0]) {
                if (!roadFull && addrRes[0].road_address)
                  roadFull = addrRes[0].road_address.address_name;
                if (!jibunFull) jibunFull = addrRes[0].address.address_name;
              }

              // 길거리 핀에서 도로명 누락 시 주변 반경 탐색
              if (!roadFull) {
                const ps = new kakao.maps.services.Places();
                const nearbyFullRoad = await new Promise((res) => {
                  ps.categorySearch(
                    "CS2",
                    (d, s) => {
                      // 편의점 우선
                      if (
                        s === kakao.maps.services.Status.OK &&
                        d[0].road_address_name
                      )
                        res(d[0].road_address_name);
                      else
                        ps.categorySearch(
                          "FD6",
                          (d2, s2) => {
                            // 식당
                            if (
                              s2 === kakao.maps.services.Status.OK &&
                              d2[0].road_address_name
                            )
                              res(d2[0].road_address_name);
                            else res("");
                          },
                          { x: lon, y: lat, radius: 100 },
                        );
                    },
                    { x: lon, y: lat, radius: 100 },
                  );
                });

                if (nearbyFullRoad) {
                  roadFull = nearbyFullRoad;
                } else if (addrRes && addrRes[0]) {
                  const fallbackRoad =
                    (await window.getNearbyRoadNameAsync(lat, lon)) || "";
                  if (fallbackRoad)
                    roadFull = `${addrRes[0].address.region_1depth_name} ${addrRes[0].address.region_2depth_name} ${fallbackRoad}`;
                }
              }

              // 3. SIDO 포맷 통일
              if (roadFull && SIDO_MAP[roadFull.split(" ")[0]])
                roadFull = roadFull.replace(
                  roadFull.split(" ")[0],
                  SIDO_MAP[roadFull.split(" ")[0]],
                );
              if (jibunFull && SIDO_MAP[jibunFull.split(" ")[0]])
                jibunFull = jibunFull.replace(
                  jibunFull.split(" ")[0],
                  SIDO_MAP[jibunFull.split(" ")[0]],
                );

              // 4. 지번 주소에서 법정동을 행정동으로 깔끔하게 교체 (한글 정규식 버그 완전 해결)
              if (jibunFull && currentCleanDong) {
                const parts = jibunFull.split(" ");
                // 띄어쓰기를 기준으로 배열로 나눈 뒤, 정확히 '동/읍/면'이 있는 위치를 찾아 통째로 갈아끼움
                const dongIdx = parts.findIndex(
                  (p) =>
                    p === safeLegalDong ||
                    p.endsWith("동") ||
                    p.endsWith("읍") ||
                    p.endsWith("면"),
                );
                if (dongIdx !== -1) {
                  parts[dongIdx] = currentCleanDong;
                  jibunFull = parts.join(" ");
                }

                // 한글에 먹히지 않는 \b 정규식 대신, 단순 띄어쓰기 기준으로 중복 단어 제거 (예: 석수1동 석수1동 -> 석수1동)
                const dupRegex = new RegExp(
                  `${currentCleanDong}\\s+${currentCleanDong}`,
                  "g",
                );
                jibunFull = jibunFull.replace(dupRegex, currentCleanDong);
              }

              // 5. 도로명 추출
              currentCleanRoad = roadFull
                ? roadFull.match(/\S+(?:로|길|대로)/)?.[0] || ""
                : "";

              const prefKey = window.getAddrKey
                ? window.getAddrKey()
                : "udong_addr_type_buyer";
              const isRoadState = localStorage.getItem(prefKey) === "road";
              let finalAddr = isRoadState && roadFull ? roadFull : jibunFull;

              // [요구사항 반영] 기존에 골치를 썩이던 knownPlaceData.place_name(건물/장소명) 강제 덧붙임 로직 완전 삭제!

              document.getElementById("reqCustomLoc").value =
                finalAddr || "주소를 찾을 수 없습니다.";
            });
          }
        });
      };

      // 1. 팝업 지도가 로드되자마자 내 초기 위치의 '전체 상세 주소'를 즉시 세팅
      updateInputToFullAddress(defaultLat, defaultLon);

      // 2. 지도를 마우스로 클릭해서 핀을 옮길 때 '전체 상세 주소' 업데이트 (클릭 이벤트 신규 추가)
      kakao.maps.event.addListener(reqMap, "click", function (mouseEvent) {
        if (
          document.querySelector('input[name="locType"]:checked').value !==
          "custom"
        )
          return;
        const lat = mouseEvent.latLng.getLat();
        const lon = mouseEvent.latLng.getLng();

        const dist = window.udongCalculateDistance(
          selectedLoc.lat || 37.4979,
          selectedLoc.lon || 127.0276,
          lat,
          lon,
        );
        if (dist > radiusLimit) {
          alert(
            `인증 지역 반경(${radiusLimit / 1000}km)을 벗어날 수 없습니다.`,
          );
          return;
        }
        reqMarker.setPosition(mouseEvent.latLng);
        defaultLat = lat;
        defaultLon = lon;
        updateInputToFullAddress(defaultLat, defaultLon);
      });

      const btnSearch = document.getElementById("btnReqLocSearch");
      const customLocInput = document.getElementById("reqCustomLoc");
      const resultList = document.getElementById("reqLocResultList");

      const execSearch = () => {
        const keyword = customLocInput.value.trim();
        if (!keyword) return alert("검색할 장소명을 입력해주세요.");
        btnSearch.innerText = "검색중..";
        btnSearch.disabled = true;

        const ps = new kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
          btnSearch.innerText = "검색";
          btnSearch.disabled = false;

          if (status === kakao.maps.services.Status.OK) {
            const validData = data.filter((place) => {
              const dist = window.udongCalculateDistance(
                selectedLoc.lat || 37.4979,
                selectedLoc.lon || 127.0276,
                parseFloat(place.y),
                parseFloat(place.x),
              );
              return dist <= radiusLimit;
            });
            resultList.innerHTML = "";
            if (validData.length > 0) {
              validData.forEach((place) => {
                const li = document.createElement("li");
                li.style.cssText =
                  "padding:12px 16px; border-bottom:1px solid #f1f3f5; cursor:pointer; font-size:13px; text-align:left; transition: background 0.2s;";
                li.onmouseenter = () => (li.style.background = "#f8f9fa");
                li.onmouseleave = () => (li.style.background = "white");
                li.innerHTML = `<strong style="color:#212529; display:block; margin-bottom:2px;">${place.place_name}</strong><span style="color:#868e96; font-size:11px;">${place.road_address_name || place.address_name}</span>`;

                li.onclick = () => {
                  const moveLatLon = new kakao.maps.LatLng(place.y, place.x);
                  reqMap.panTo(moveLatLon);
                  reqMarker.setPosition(moveLatLon);
                  defaultLat = parseFloat(place.y);
                  defaultLon = parseFloat(place.x);

                  // [핵심 해결] 길고 낡은 자체 파싱 로직을 전부 버리고, 완벽하게 고쳐둔 공통 함수에 검색 데이터(place)만 넘김!
                  updateInputToFullAddress(defaultLat, defaultLon, place);
                  resultList.style.display = "none";
                };
                resultList.appendChild(li);
              });
            } else {
              resultList.innerHTML = `<li style="padding:16px; text-align:center; color:#fa5252; font-size:13px;">인증 동네 반경(${radiusLimit / 1000}km)을 벗어난 장소입니다.</li>`;
            }
            resultList.style.display = "block";
          } else {
            resultList.innerHTML = `<li style="padding:16px; text-align:center; color:#868e96; font-size:13px;">검색 결과가 없습니다.</li>`;
            resultList.style.display = "block";
          }
        });
      };

      btnSearch.onclick = execSearch;
      customLocInput.onkeydown = (e) => {
        if (e.key === "Enter" && !customLocInput.readOnly) execSearch();
      };

      document.addEventListener("click", (e) => {
        if (
          !e.target.closest("#reqLocResultList") &&
          e.target.id !== "reqCustomLoc" &&
          e.target.id !== "btnReqLocSearch"
        ) {
          resultList.style.display = "none";
        }
      });

      // 3. (마커 드래그 기능이 켜져 있을 경우) 마커를 끌어다 놓을 때 '전체 상세 주소' 업데이트
      kakao.maps.event.addListener(reqMarker, "dragend", function () {
        if (
          document.querySelector('input[name="locType"]:checked').value !==
          "custom"
        )
          return;
        const pos = reqMarker.getPosition();

        const dist = window.udongCalculateDistance(
          selectedLoc.lat || 37.4979,
          selectedLoc.lon || 127.0276,
          pos.getLat(),
          pos.getLng(),
        );
        if (dist > radiusLimit) {
          alert(
            `인증 지역 반경(${radiusLimit / 1000}km)을 벗어날 수 없습니다.`,
          );
          const revertPos = new kakao.maps.LatLng(defaultLat, defaultLon);
          reqMarker.setPosition(revertPos);
          reqMap.panTo(revertPos);
          return;
        }

        defaultLat = pos.getLat();
        defaultLon = pos.getLng();

        document.getElementById("reqCustomLoc").value = "위치 탐색 중...";
        updateInputToFullAddress(defaultLat, defaultLon);
      });
    } catch (e) {
      console.error("카카오 지도 로드 실패:", e);
      document.getElementById("reqKakaoMap").innerHTML =
        `<div style="padding:50px 20px; text-align:center; color:#adb5bd; font-size:13px;">네트워크 차단 등으로 지도를 불러올 수 없습니다.<br>'직접 장소 검색' 기능을 이용해주세요.</div>`;
    }

    const locRadios = overlay.querySelectorAll('input[name="locType"]');
    const locInput = document.getElementById("reqCustomLoc");
    const btnSearch = document.getElementById("btnReqLocSearch");

    locRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.value === "custom") {
          locInput.readOnly = false;
          btnSearch.style.display = "block";
          if (reqMarker) reqMarker.setDraggable(true);
          locInput.placeholder = "상호명이나 주소를 입력 후 검색하세요.";
          locInput.value = "";
          locInput.focus();
        } else {
          locInput.readOnly = true;
          btnSearch.style.display = "none";
          document.getElementById("reqLocResultList").style.display = "none";
          if (reqMarker) {
            reqMarker.setDraggable(false);
            const moveLatLon = new kakao.maps.LatLng(
              selectedLoc.lat || 37.4979,
              selectedLoc.lon || 127.0276,
            );
            reqMarker.setPosition(moveLatLon);
            reqMap.panTo(moveLatLon);
            defaultLat = selectedLoc.lat || 37.4979;
            defaultLon = selectedLoc.lon || 127.0276;

            if (typeof updateInputToFullAddress === "function") {
              updateInputToFullAddress(defaultLat, defaultLon);
            }
          }
        }
      });
    });
  }, 100);

  // [수정] 멈춤 버그 해결 및 통짜 주소(rawFullAddress) 추출 안전장치 추가
  document.getElementById("btnSubmitRequest").onclick = async () => {
    const title = document.getElementById("reqTitle").value.trim();
    const desc = document.getElementById("reqDesc").value.trim();
    const budget = document.getElementById("reqBudget").value.trim();
    const deadline = document.getElementById("reqDeadline").value;
    const rawFullAddress = document.getElementById("reqCustomLoc").value.trim();

    // 혹시라도 지도를 건드리지 않아서 동(Dong) 이름이 비어있다면 주소창 텍스트에서 강제 추출 (에러 방어)
    if (!currentCleanDong && rawFullAddress) {
      currentCleanDong = rawFullAddress.split(" ").pop();
    }

    if (
      !title ||
      !desc ||
      !budget ||
      !deadline ||
      !currentCleanDong ||
      !rawFullAddress
    ) {
      alert("필수 항목을 모두 올바르게 입력해주세요. (거래 희망 장소 확인)");
      return;
    }

    const btn = document.getElementById("btnSubmitRequest");
    btn.disabled = true;
    btn.innerText = "등록 중...";

    try {
      const reqData = {
        title,
        desc,
        budget,
        category: document.getElementById("reqCategory").value,
        estimatedParticipants:
          document.getElementById("reqParticipants").value || "미정",
        receiveMethod: document.getElementById("reqReceive").value,
        link: document.getElementById("reqLink").value.trim(),
        deadline: deadline.replace(/[-:T]/g, ""),
        location: currentCleanDong,
        roadAddr: currentCleanRoad,
        rawFullAddress: rawFullAddress, // BFF 아키텍처: 통짜 텍스트를 Worker로 보내서 가공시킴
        lat: defaultLat,
        lon: defaultLon,
        author: myInfo.nickname,
      };

      const res = await UdongAPI.createRequest(reqData);
      if (res) {
        alert("공구 요청이 성공적으로 등록되었습니다!");
        overlay.remove();
        location.reload();
      } else {
        throw new Error("서버 응답 없음");
      }
    } catch (e) {
      console.error("등록 에러:", e);
      alert("등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      btn.disabled = false;
      btn.innerText = "요청 등록";
    }
  };
};

// 5. 입찰 제안 팝업 (판매자용)
window.openBidModal = function (requestId, itemTitle) {
  // [완벽 방어] 이미 화면에 열려있는 모달(오버레이)이 있다면 중복 실행 방지
  if (document.querySelector(".udong-modal-overlay")) return;

  injectModalStyles();

  // ★ 1번 요청사항: 7일 후 기한 계산 적용
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  maxDate.setMinutes(maxDate.getMinutes() - maxDate.getTimezoneOffset());
  const maxDateTime = maxDate.toISOString().slice(0, 16);

  const overlay = document.createElement("div");
  overlay.className = "udong-modal-overlay";
  overlay.innerHTML = `
    <div class="udong-modal-box">
      <div class="udong-modal-header">
        <h3 class="udong-modal-title">🤝 입찰 제안하기</h3>
        <button class="btn-modal-close" onclick="this.closest('.udong-modal-overlay').remove()">✕</button>
      </div>
      <div class="udong-modal-body">
        <button type="button" id="btnDummyBid" style="font-size:12px; padding:6px 12px; background:#f1f3f5; color:#495057; border:none; border-radius:6px; margin-bottom:15px; cursor:pointer; font-weight:700;">🧪 빠른 제안 초안 작성 (다양한 옵션 제공)</button>
        
        <div style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:16px; font-size:13px; color:#495057;">
          <strong>요청글:</strong> ${itemTitle}
        </div>
        
        <div class="udong-form-group">
          <label class="udong-form-label">1. 제안 상품 이름</label>
          <input type="text" id="bidProductName" class="udong-form-input" placeholder="예: 청송 꿀사과 5kg 박스">
        </div>

        <div class="udong-form-group">
          <label class="udong-form-label">2. 상품 대표 이미지 등록</label>
          <div style="display:flex; gap:15px; margin-bottom:8px;">
             <label style="font-size:13px;"><input type="radio" name="imgType" value="file" checked> 파일 첨부</label>
             <label style="font-size:13px;"><input type="radio" name="imgType" value="url"> 웹 URL 주소</label>
          </div>
          <input type="file" id="bidImageFile" class="udong-form-input" accept="image/*" style="padding: 8px;">
          <input type="url" id="bidImageUrl" class="udong-form-input" placeholder="https://..." style="display:none;">
        </div>
        
        <div style="display:flex; gap:10px;">
          <div class="udong-form-group" style="flex:1;">
            <label class="udong-form-label">3. 1인당 최종 가격 (원)</label>
            <input type="number" id="bidPrice" class="udong-form-input" placeholder="최종 할인가" step="100" min="0">
          </div>
          <div class="udong-form-group" style="flex:1;">
            <label class="udong-form-label">4. 최소 성사 인원</label>
            <input type="number" id="bidMinParticipants" class="udong-form-input" placeholder="예: 5" min="2" value="2">
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <div class="udong-form-group" style="flex:1;">
            <label class="udong-form-label">5. 공구 모집 마감일 (최대 7일)</label>
            <input type="datetime-local" id="bidDeadline" class="udong-form-input" min="${minDateTime}" max="${maxDateTime}">
          </div>
          <div class="udong-form-group" style="flex:1;">
            <label class="udong-form-label">6. 예상 수령일</label>
            <input type="date" id="bidReceiveDate" class="udong-form-input">
          </div>
        </div>

        <div class="udong-form-group">
          <label class="udong-form-label">7. 실제 수령 방식</label>
          <select id="bidReceiveMethod" class="udong-form-input">
            <option value="delivery_seller" selected>요청하신 장소로 판매자가 직접 배달</option>
            <option value="delivery_group">요청하신 장소로 일괄 배송</option>
            <option value="pickup">우리 매장으로 직접 방문 요망 (배달 불가)</option>
          </select>
        </div>

        <div class="udong-form-group">
          <label class="udong-form-label">8. 상품 특성 및 이벤트 (다중 선택)</label>
          <div style="display:flex; gap:15px; padding: 5px 0;">
            <label style="font-size:14px; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" name="bidTags" value="fresh"> 🌱 신선식품 (냉장/냉동)
            </label>
            <label style="font-size:14px; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" id="chkEventTag" name="bidTags" value="event"> 🎁 이벤트 제공
            </label>
          </div>
          <div id="eventDetailsWrap" style="display:none; background:#f8f9fa; padding:12px; border-radius:8px; border:1px solid #e9ecef; margin-top:8px;">
            <label style="font-size:12px; font-weight:700; color:#868e96; display:block; margin-bottom:6px;">이벤트/혜택 선택 (목록 카드에 노출됩니다)</label>
            <select id="bidEventType" class="udong-form-input">
              <option value="사은품 증정">사은품 증정</option>
              <option value="리뷰 즉시 할인">리뷰 즉시 할인</option>
              <option value="단골 전용 덤">단골 전용 덤</option>
              <option value="당일 수확 특가">당일 수확 특가</option>
              <option value="선착순 특가">선착순 특가</option>
              <option value="용량/사이즈 업">용량/사이즈 업</option>
              <option value="묶음 할인(N+1)">묶음 할인(N+1)</option>
              <option value="타임 세일">타임 세일</option>
              <option value="포장/패키지 무료">포장/패키지 무료</option>
            </select>
          </div>
        </div>

        <div class="udong-form-group">
          <label class="udong-form-label">9. 제안 메시지</label>
          <textarea id="bidMsg" class="udong-form-input" placeholder="상품의 품질, 배송 조건 등 어필할 내용을 적어주세요."></textarea>
        </div>
      </div>
      <div class="udong-modal-footer">
        <button class="btn-modal-cancel" onclick="this.closest('.udong-modal-overlay').remove()">취소</button>
        <button class="btn-modal-submit seller" id="btnSubmitBid">제안하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  // 🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️
  // 👇👇👇 [삭제 전용 코드 구역 시작] 실제 백엔드 연동 및 상용화 시 통째로 삭제하세요 👇👇👇
  // (기능: 데모 시연을 위해 구매자의 요청 제목을 분석하여 상황에 맞는 입찰 제안 팝업을 채워주는 매크로)
  document.getElementById("btnDummyBid").onclick = () => {
    const titleStr = itemTitle || "";
    let bidTitle = "";
    let bidMsg = "";
    let tag = "";
    let keyword = "product";

    // [요구사항 반영] 구매자의 공구 요청(키워드)을 분석하여 그에 맞는 전문적인 B2B/도매상 컨셉의 답변 생성
    if (titleStr.includes("생수") || titleStr.includes("탄산수")) {
      bidTitle = `[음료 총판] ${titleStr} 정기 납품 제안합니다`;
      bidMsg =
        "안녕하세요! 인근 지역 음료 총판입니다. 요청하신 수량 충분히 재고 있으며, 원하시는 날짜에 맞춰 사무실 앞까지 안전하게 배달해 드릴 수 있습니다. 첫 거래 시 생수 1팩 서비스로 더 챙겨드리겠습니다!";
      tag = "첫 거래 1팩 추가 증정";
      keyword = "water";
    } else if (
      titleStr.includes("A4") ||
      titleStr.includes("종이컵") ||
      titleStr.includes("휴지") ||
      titleStr.includes("물티슈")
    ) {
      bidTitle = `[유통전문] ${titleStr} 최저가 도매 납품`;
      bidMsg =
        "안녕하세요, 생활/사무용품 전문 유통업체입니다. 대량 구매 요청 확인했으며, 시중가보다 저렴하게 단가 맞춰드릴 수 있습니다. 정기 거래로 이어지면 추가 할인도 가능하니 긍정적인 검토 부탁드립니다.";
      tag = "정기 거래 시 단가 할인";
      keyword = "office";
    } else if (titleStr.includes("삼겹살") || titleStr.includes("고기")) {
      bidTitle = `[마장동 직송] ${titleStr} 질 좋은 고기 준비완료!`;
      bidMsg =
        "동네 정육점 운영하고 있습니다. 단체 행사용으로 쓰신다니 질 좋고 맛있는 부위로 넉넉하게 썰어드리겠습니다! 파채랑 찌개용 돼지고기 조금 서비스로 같이 챙겨드릴게요. 즐거운 행사 되시길 바랍니다.";
      tag = "파채/찌개용 고기 덤 증정";
      keyword = "meat";
    } else if (
      titleStr.includes("간식") ||
      titleStr.includes("과자") ||
      titleStr.includes("꾸러미")
    ) {
      bidTitle = `[동네마트] ${titleStr} 맞춤형 포장 가능합니다`;
      bidMsg =
        "행사용 간식 문의주셨네요! 아이들이 좋아하는 인기 과자들로만 알차게 구성해서 납품 가능합니다. 원하시면 박스 단위가 아니라 인원수에 맞게 소포장 작업까지 해서 깔끔하게 보내드릴 수 있습니다.";
      tag = "무료 맞춤형 소포장";
      keyword = "snacks";
    } else {
      // 그 외 일반적인 요청에 대한 대응
      const bidAdjs = [
        "확실하게",
        "최저가로",
        "빠르게",
        "최고 품질로",
        "정성껏",
      ];
      const bidTags = ["단골 전용 덤", "사은품 증정", "특가 제공", "무료 배송"];
      const adj = bidAdjs[Math.floor(Math.random() * bidAdjs.length)];
      tag = bidTags[Math.floor(Math.random() * bidTags.length)];
      bidTitle = `[특가] ${titleStr} ${adj} 준비해 드립니다`;
      bidMsg =
        "요청하신 내용 확인했습니다! 저희 가게 첫 거래 시 덤을 두둑하게 얹어드립니다. 품질은 제가 보증하며, 빠르고 안전하게 전달해 드리겠습니다. 좋은 거래 기대하겠습니다.";
      keyword = "box";
    }

    const price = Math.floor(Math.random() * 15 + 5) * 1000;
    const imgUrl = `https://loremflickr.com/300/200/${keyword}?random=${Date.now()}`;

    document.getElementById("bidProductName").value = bidTitle;
    document.getElementById("bidPrice").value = price;
    document.getElementById("bidMinParticipants").value = "5";

    const d = new Date();
    d.setDate(d.getDate() + 2);
    document.getElementById("bidDeadline").value = d.toISOString().slice(0, 16);

    const r = new Date();
    r.setDate(r.getDate() + 5);
    document.getElementById("bidReceiveDate").value = r
      .toISOString()
      .slice(0, 10);

    document.getElementById("chkEventTag").checked = true;
    document.getElementById("eventDetailsWrap").style.display = "block";
    document.getElementById("bidEventType").value = tag;
    document.getElementById("bidMsg").value = bidMsg;

    document.querySelector('input[name="imgType"][value="url"]').checked = true;
    document.getElementById("bidImageFile").style.display = "none";
    document.getElementById("bidImageUrl").style.display = "block";
    document.getElementById("bidImageUrl").value = imgUrl;
  };
  // 👆👆👆 [삭제 전용 코드 구역 끝] 👆👆👆
  // 🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️🗑️

  const imgRadios = overlay.querySelectorAll('input[name="imgType"]');
  imgRadios.forEach((r) => {
    r.addEventListener("change", (e) => {
      document.getElementById("bidImageFile").style.display =
        e.target.value === "file" ? "block" : "none";
      document.getElementById("bidImageUrl").style.display =
        e.target.value === "url" ? "block" : "none";
    });
  });

  document.getElementById("chkEventTag").addEventListener("change", (e) => {
    document.getElementById("eventDetailsWrap").style.display = e.target.checked
      ? "block"
      : "none";
  });

  document.getElementById("btnSubmitBid").onclick = async () => {
    const productName = document.getElementById("bidProductName").value.trim();
    const price = document.getElementById("bidPrice").value.trim();
    const minParticipants = document
      .getElementById("bidMinParticipants")
      .value.trim();
    const deadline = document.getElementById("bidDeadline").value;
    const msg = document.getElementById("bidMsg").value.trim();

    let imageUrl = "https://via.placeholder.com/300x200?text=이미지없음";
    const imgType = document.querySelector(
      'input[name="imgType"]:checked',
    ).value;

    if (imgType === "url" && document.getElementById("bidImageUrl").value) {
      imageUrl = document.getElementById("bidImageUrl").value.trim();
    } else {
      const fileInput = document.getElementById("bidImageFile");
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        imageUrl = URL.createObjectURL(file); // 임시 가짜 로직

        /* === [실제 백엔드 API 연동 코드 (AWS S3 Presigned URL 직접 업로드)] ===
        try {
          const token = localStorage.getItem("udong_access_token");
          
          // 1. 백엔드에 "이 파일 올릴 권한(Presigned URL) 줘!" 요청
          const preRes = await fetch(`https://api.udongmarket.com/v1/uploads/presigned-url?filename=${encodeURIComponent(file.name)}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const { uploadUrl, finalImageUrl } = await preRes.json();
          
          // 2. 백엔드를 거치지 않고 S3 스토리지로 직접 파일 쏘기 (우리 서버 부하 0%)
          await fetch(uploadUrl, { method: 'PUT', body: file });
          
          // 3. S3에 저장된 최종 이미지 주소를 가져와서 활용
          imageUrl = finalImageUrl;
        } catch (error) {
          alert("이미지 업로드에 실패했습니다.");
          return;
        }
        ============================================================== */
      }
    }

    let eventText = "";
    if (document.getElementById("chkEventTag").checked) {
      eventText = document.getElementById("bidEventType").value;
    }

    const tags = Array.from(
      document.querySelectorAll('input[name="bidTags"]:checked'),
    ).map((cb) => cb.value);

    if (!productName || !price || !minParticipants || !deadline || !msg) {
      alert("필수 제안 항목을 입력해주세요.");
      return;
    }

    const btn = document.getElementById("btnSubmitBid");
    btn.disabled = true;
    btn.innerText = "처리 중...";

    try {
      const formattedDeadline = deadline.replace(/[-:T]/g, "");
      const bidData = {
        productName,
        price,
        minParticipants,
        tags,
        message: msg,
        eventText,
        imageUrl,
        deadline: formattedDeadline,
      };

      const res = await UdongAPI.submitBid(requestId, bidData);
      if (res) {
        alert("입찰 제안이 성공적으로 전달되었습니다!");
        overlay.remove();
        location.reload();
      }
    } catch (e) {
      alert("제안 중 오류가 발생했습니다.");
    } finally {
      // ★ 버튼 원상복구
      btn.disabled = false;
      btn.innerText = "제안하기";
    }
  };
};

// 14. 사용자 요약 정보 가져오기
UdongAPI.getUserSummary = async (role) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/users/summary?role=${role}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`서버 에러: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("서버 요약 정보 로드 실패:", error);
    return {
      totalSavings: 0, activeItem: null, totalCount: 0, 
      inProgressCount: 0, successCount: 0, settlementAmount: 0
    };
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/summary?role=${role}&nickname=${myNickname}`,
    );
    if (!response.ok) throw new Error("BFF 요약 데이터 응답 에러");

    const data = await response.json();

    // ★ 판매자 위젯이 에러나서 크래시되지 않도록 기본값(Mock) 강제 주입 방어
    data.inProgressCount = data.inProgressCount || 2;
    data.successCount = data.successCount || 1;
    data.settlementAmount = data.settlementAmount || 45000;

    return data;
  } catch (e) {
    console.error("서버 요약 정보 로드 실패:", e);
    return {
      totalSavings: 0,
      activeItem: null,
      totalCount: 0,
      inProgressCount: 0,
      successCount: 0,
      settlementAmount: 0,
    };
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 15. 최근 본 공구 목록 불러오기 API
UdongAPI.getRecentItems = async (role) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/users/recent?role=${role}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`서버 에러: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("최근 본 공구 로드 실패:", error);
    return [];
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/recent?role=${role}&nickname=${encodeURIComponent(myNickname)}`,
    );

    if (!response.ok) throw new Error("BFF 통신 실패");
    return await response.json();
  } catch (error) {
    console.error("최근 본 공구 로드 실패:", error);
    return [];
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 16. 메인 피드 데이터 요청 API
UdongAPI.getFeed = async (viewMode, stateFilters, userContext) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const params = new URLSearchParams({
      viewMode: viewMode,
      category: stateFilters.category || "all",
      keyword: stateFilters.keyword || "",
      statusOnlyActive: stateFilters.statusOnlyActive || false,
      priceMin: stateFilters.priceMin || 0,
      priceMax: stateFilters.priceMax || 10000000,
      tags: (stateFilters.tags || []).join(","),
      sort: stateFilters.sort || "latest",
      lat: userContext.lat || "",
      lon: userContext.lon || "",
      page: stateFilters.page || 1,
      limit: stateFilters.limit || 100
    });

    const response = await fetch(`https://api.udongmarket.com/v1/feed?${params.toString()}`, {
      // 비로그인 상태여도 피드는 볼 수 있어야 하므로 토큰은 선택적으로 전달
      headers: token ? { "Authorization": `Bearer ${token}` } : {} 
    });
    
    if (!response.ok) throw new Error(`피드 데이터 로드 실패: ${response.status}`);
    return await response.json(); // { list: [...], counts: { products: 0, requests: 0 } }
  } catch (error) {
    console.error("메인 피드 데이터 통신 에러:", error);
    return { list: [], counts: { products: 0, requests: 0 } };
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const currentPage = stateFilters.page || 1;
    const params = new URLSearchParams({
      viewMode: viewMode,
      category: stateFilters.category || "all",
      keyword: stateFilters.keyword || "",
      statusOnlyActive: stateFilters.statusOnlyActive || false,
      priceMin: stateFilters.priceMin || 0,
      priceMax: stateFilters.priceMax || 10000000,
      tags: (stateFilters.tags || []).join(","),
      sort: stateFilters.sort || "latest",

      lat: userContext.lat || "",
      lon: userContext.lon || "",
      location: userContext.location || "",
      nickname: (getUserInfo() || { nickname: "익명" }).nickname,
      role: userContext.role || "buyer", // [핵심 해결] 백엔드(Worker)에 현재 권한을 보내주어 관리자 1년 노출 보장
      page: currentPage,
      limit: stateFilters.limit || 100,
    });

    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/feed?${params.toString()}`,
    );
    if (!response.ok) throw new Error("서버리스 응답 에러");
    const data = await response.json();

    // ★ 프론트엔드 로컬스토리지(temp_requests) 병합 로직 완전 삭제 완료
    // 이제 오직 Cloudflare Worker가 한글로 완벽히 가공해서 보내주는 순수 피드 데이터만 화면에 그립니다.

    return data;
  } catch (e) {
    console.error("서버리스 연결 실패:", e);
    return { list: [], counts: { products: 0, requests: 0 } };
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 20. 사이드바용 최신 공구 요청 목록 가져오기 (중복 삭제 및 서버 연동)
UdongAPI.getSidebarRequests = async () => {
  try {
    // 빈 껍데기(window.feedData)를 찾지 않고 서버리스 API에 5개만 직접 요청
    const res = await UdongAPI.getFeed(
      "requests",
      { limit: 5, sort: "latest" },
      {},
    );
    return res.list || [];
  } catch (e) {
    return [];
  }
};

// 18. 게시글 상세 정보 가져오기 (초고속 단건 API 연동 완료)
UdongAPI.getPostDetail = async (type, id) => {
  try {
    const role = localStorage.getItem("udong_user_role") || "buyer";
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;

    // [수정] 단건 조회 시에도 권한과 닉네임을 보내어 백엔드가 '입찰 여부(myBid)'를 판단할 수 있게 함
    const res = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/posts/${id}?role=${role}&nickname=${encodeURIComponent(myNickname)}`,
    );
    if (!res.ok) throw new Error("게시글 조회 실패");
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("게시글 단건 조회 에러:", e);
    return null;
  }
};

// 19. 현재 사용자의 인증 및 위치 컨텍스트 가져오기
UdongAPI.getUserContext = async (role) => {
  /* === [실제 백엔드 API 연동 코드] ===
    // (기존 코드 유지)
    ============================================= */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드 가짜 로직 시작] 👇👇👇
  let context = { location: null, lat: null, lon: null, isVerified: false };

  // [핵심 수정] 성격 급하게 빈 로컬 스토리지를 읽지 않고, KV 서버 동기화가 보장된 API를 통해 데이터를 기다림 (await)
  let locs = [];
  try {
    locs = await UdongAPI.getUserLocations(role);
  } catch (e) {
    console.warn("위치 컨텍스트 로드 실패", e);
  }

  const target = locs.find((l) => l.selected);

  if (target) {
    if (role === "buyer") {
      context.isVerified = target.verified && !target.expired;
      if (context.isVerified) {
        context.location = target.name;
        context.lat = target.lat;
        context.lon = target.lon;
      }
    } else {
      context.isVerified = true;
      context.location =
        target.name !== "전체 지역"
          ? target.name.split(">").pop().trim()
          : null;
      context.lat = target.lat;
      context.lon = target.lon;
    }
  }
  return context;
  // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
};

// 22. 검색어 기록 관리 API (KV 완전 동기화 버전)
UdongAPI.getSearchHistory = async () => {
  const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
  const res = await fetch(
    `https://udong-bff.wsp485786.workers.dev/api/users/search-history?nickname=${encodeURIComponent(myNickname)}`,
  );
  return res.ok ? await res.json() : [];
};

UdongAPI.saveSearchHistory = async (keyword) => {
  const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
  await fetch(
    `https://udong-bff.wsp485786.workers.dev/api/users/search-history?nickname=${encodeURIComponent(myNickname)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    },
  );
};

// 23. 최근 본 공구 전체 삭제 API
UdongAPI.clearRecentItems = async (role) => {
  /* === [실제 백엔드 API 연동 코드] ===
  try {
    const token = localStorage.getItem("udong_access_token");
    const response = await fetch(`https://api.udongmarket.com/v1/users/recent?role=${role}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`서버 에러: ${response.status}`);
    return true;
  } catch (error) {
    console.error("최근 본 공구 삭제 실패:", error);
    return false;
  }
  ============================================================== */

  // 👇👇👇 [백엔드 연동 시 통째로 삭제되어야 할 프론트엔드/BFF 임시 로직] 👇👇👇
  try {
    const myNickname = (getUserInfo() || { nickname: "익명" }).nickname;
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/recent?role=${role}&nickname=${encodeURIComponent(myNickname)}`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("BFF 통신 실패");
    return true;
  } catch (e) {
    console.error("최근 본 공구 삭제 실패:", e);
    return false;
  }
  // 👆👆👆 [프론트엔드 임시 로직 끝] 👆👆👆
};

// 24. 소셜 로그인 및 JWT 발급 API (인증/인가)
UdongAPI.login = async (provider, authCode) => {
  /* === [실제 백엔드 API 연동 코드 (OAuth 2.0 + JWT 토큰 발급)] ===
    try {
      // 1. 카카오/네이버 등에서 받은 인가 코드(authCode)를 우리 백엔드로 전달
      const response = await fetch(`https://api.udongmarket.com/v1/auth/login/${provider}`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: authCode })
      });
      
      if (!response.ok) throw new Error("로그인 인증 실패");
      
      // 2. 백엔드가 검증 후 발급해준 JWT(액세스 토큰)와 유저 정보를 수신
      const data = await response.json();
      
      // 3. 토큰과 권한(Role)을 로컬 스토리지에 안전하게 저장 (이후 모든 통신 헤더에 Authorization: Bearer {token} 으로 첨부됨)
      localStorage.setItem("udong_access_token", data.accessToken);
      localStorage.setItem("udong_is_logged_in", "true");
      localStorage.setItem("udong_user_role", data.role); // buyer, seller, admin 중 1
      localStorage.setItem("udong_user_info", JSON.stringify(data.userInfo));
      
      return true;
    } catch (error) {
      console.error("로그인 API 에러:", error);
      return false;
    }
    ============================================= */
};

// 25. 게시글 조회수 증가 API (중복 방지)
UdongAPI.incrementViewCount = async (postId, nickname) => {
  /* === [실제 백엔드 API 연동 시 주석 해제] ===
  // const token = localStorage.getItem("udong_access_token");
  // const response = await fetch(`/api/v1/posts/${postId}/views`, { method: 'POST', headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });
  // const data = await response.json();
  // return data.views;
  ============================================= */

  // 👇👇👇 [Cloudflare Worker 연동 프론트엔드 임시 로직] 👇👇👇
  try {
    const response = await fetch(
      `https://udong-bff.wsp485786.workers.dev/api/posts/${postId}/views`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: nickname }),
      },
    );
    const data = await response.json();
    return data.views || 0;
  } catch (e) {
    return 0;
  }
  // 👆👆👆 [프론트엔드 가짜 로직 끝] 👆👆👆
};

window.UdongAPI = UdongAPI;
window.FeedAPI = UdongAPI;

// =========================================================================
// [수정] 검색 경로 오류 해결 및 전역 상태 동기화 로직 (/pages/ 경로 적용)
// =========================================================================
document.addEventListener("keydown", (e) => {
  if (e.target?.id === "searchInput" && e.key === "Enter") {
    e.preventDefault();
    executeGlobalSearch();
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("#searchBtn")) {
    e.preventDefault();
    executeGlobalSearch();
  }
});

function executeGlobalSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const kw = input.value.trim();

  if (kw) {
    UdongAPI.saveSearchHistory(kw);
    localStorage.setItem("udong_pending_search", kw);
  } else {
    localStorage.removeItem("udong_pending_search");
  }

  const isMainPage = location.pathname.includes("main.html");
  if (!isMainPage && !location.pathname.includes("admin_center.html")) {
    // 5) 요구사항: /html/이 아닌 /pages/ 경로 적용
    const rootIdx = location.pathname.indexOf("/pages/");
    const prefix = rootIdx >= 0 ? location.pathname.substring(0, rootIdx) : "";
    location.href = prefix + "/pages/main/main.html";
  } else if (isMainPage) {
    window.dispatchEvent(new CustomEvent("executeSearchEvent"));
  }
}

// [테스트 전용 코드] 백엔드 연동 및 실제 로그인 구현 시 아래 코드는 통째로 삭제
function initLoginToggle() {
  // ... 기존 로직 유지 ...
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  const userRole = localStorage.getItem("udong_user_role");
  let btnText = "현재: 비로그인";
  let btnColor = "#868e96";

  if (isLoggedIn) {
    if (userRole === "seller") {
      btnText = "현재: 판매자 (Seller)";
      btnColor = "#4c6ef5";
    } else if (userRole === "admin") {
      btnText = "현재: 관리자 (Admin)";
      btnColor = "#e03131";
    } else {
      btnText = "현재: 구매자 (Buyer)";
      btnColor = "#212529";
    }
  }

  const toggleBtn = document.createElement("button");
  toggleBtn.innerText = btnText + " (전환)";
  toggleBtn.className = "debug-login-toggle";
  toggleBtn.style.position = "fixed";
  toggleBtn.style.bottom = "20px";
  toggleBtn.style.left = "20px";
  toggleBtn.style.padding = "10px 15px";
  toggleBtn.style.backgroundColor = btnColor;
  toggleBtn.style.color = "white";
  toggleBtn.style.borderRadius = "30px";
  toggleBtn.style.zIndex = "2147483647";
  toggleBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  toggleBtn.style.fontSize = "12px";
  toggleBtn.style.fontWeight = "bold";
  toggleBtn.style.cursor = "pointer";

  toggleBtn.addEventListener("click", () => {
    if (!isLoggedIn) {
      localStorage.setItem("udong_is_logged_in", "true");
      localStorage.setItem("udong_user_role", "buyer");
      localStorage.setItem("userId", "1"); // 임시 ID 추가!
      localStorage.setItem(
        "udong_user_info",
        JSON.stringify({ nickname: "우동이" }),
      );
    } else if (userRole === "buyer") {
      localStorage.setItem("udong_user_role", "seller");
      localStorage.setItem(
        "udong_user_info",
        JSON.stringify({ nickname: "신선과일가게" }),
      );
    } else if (userRole === "seller") {
      localStorage.setItem("udong_user_role", "admin");
      localStorage.setItem(
        "udong_user_info",
        JSON.stringify({ nickname: "슈퍼관리자" }),
      );
    } else {
      localStorage.setItem("udong_is_logged_in", "false");
      localStorage.removeItem("udong_user_role");
      localStorage.removeItem("udong_user_info");
    }
    location.reload();
  });
  document.body.appendChild(toggleBtn);
}
//  =================================================================
