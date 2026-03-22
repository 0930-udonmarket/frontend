// 로컬 상품 이미지 목록 (item.id 기반으로 순환)
const PRODUCT_IMAGES = [
  '../../images/main/baby_toy.jpg',
  '../../images/main/bagel.jpg',
  '../../images/main/beef.jpg',
  '../../images/main/bodywash.jpg',
  '../../images/main/book.jpg',
  '../../images/main/cable.jpg',
  '../../images/main/cat_snack.jpg',
  '../../images/main/diaper.jpg',
  '../../images/main/dog_wash.jpg',
  '../../images/main/egg.jpg',
  '../../images/main/nintendo.jpg',
  '../../images/main/shirts.jpg',
  '../../images/main/shuttlecock.jpg',
  '../../images/main/stand.jpg',
  '../../images/main/tangerine.jpg',
  '../../images/main/zipperback.jpg',
];

document.addEventListener("DOMContentLoaded", () => {
  const IS_LOGGED_IN = localStorage.getItem("udong_is_logged_in") === "true";
  const USER_ROLE = localStorage.getItem("udong_user_role") || "buyer";
  const MY_INFO = JSON.parse(localStorage.getItem("udong_user_info")) || {
    nickname: "익명",
  };

  if (IS_LOGGED_IN) {
    document.body.classList.add(`role-${USER_ROLE}`);
  }

  const MAX_PRICE = 100000;
  const WISHLIST_KEY = "udong_wishlist";
  const SEARCH_HISTORY_KEY = "udong_search_history";

  const state = {
    keyword: "",
    category: "all",
    tags: [],
    statusOnlyActive: false,
    priceMin: 0,
    priceMax: MAX_PRICE,
    sort: "latest",
    location: null,
    lat: null,
    lon: null,
    viewMode: "products",
    role: USER_ROLE,
  };

  const productGrid = document.getElementById("productGrid");
  const feedTitle = document.getElementById("feedTitle");
  const feedFilters = document.getElementById("feedFilters");
  const sortOptions = document.getElementById("sortOptions");
  const statusFilterSection = document.getElementById("statusFilterSection");
  const priceFilterSection = document.getElementById("priceFilterSection");
  const requestWidget = document.getElementById("requestWidget");
  const categoryBtns = document.querySelectorAll(".category-item");
  const categoryList = document.querySelector(".category-list");
  const tagBtns = document.querySelectorAll(".feed-filters .filter-btn");
  const toggleStatus = document.getElementById("toggleStatus");
  const sortOptionsBtns = document.querySelectorAll(".sort-option");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const sliderTrack = document.getElementById("sliderTrack");
  const handleMin = document.getElementById("handleMin");
  const handleMax = document.getElementById("handleMax");
  const progress = document.getElementById("sliderProgress");
  const recentItemsList = document.getElementById("recentItemsList");
  const btnClearRecent = document.getElementById("btnClearRecent");

  const LOCATION_COORDS = {
    역삼1동: { lat: 37.4954, lon: 127.0333 },
    논현1동: { lat: 37.5111, lon: 127.0212 },
    청담동: { lat: 37.524, lon: 127.0495 },
    삼성동: { lat: 37.5143, lon: 127.0565 },
    도곡동: { lat: 37.4908, lon: 127.0463 },
    시흥3동: { lat: 37.4365, lon: 126.9026 },
    시흥1동: { lat: 37.4523, lon: 126.9001 },
    시흥2동: { lat: 37.4452, lon: 126.9082 },
    독산2동: { lat: 37.4651, lon: 126.8981 },
    default: { lat: 37.4979, lon: 127.0276 },
  };

  /* ==========================================================================
     [1] 가짜 데이터베이스 (MOCK_DB)
     ========================================================================== */
  let MOCK_DB = { products: [], requests: [] };

  /* ==========================================================================
     [2] 유틸리티 함수 (좌표 생성, 시간 파싱 등)
     ========================================================================== */
  function getHashFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      let char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function getRandomCoords(baseCoords, seedStr) {
    if (!baseCoords) return null;
    const hash = getHashFromString(seedStr);
    const latOffset = ((hash % 100) / 100 - 0.5) * 0.02;
    const lonOffset = (((hash / 100) % 100) / 100 - 0.5) * 0.02;
    return { lat: baseCoords.lat + latOffset, lon: baseCoords.lon + lonOffset };
  }

  function parseCustomDate(str) {
    if (!str) return null;
    const s = String(str);
    // ISO 형식 처리 (백엔드에서 오는 "2026-03-19T15:46:26" 형식)
    if (s.includes('-') || s.includes('T')) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    // 기존 커스텀 형식 처리 ("202601291200" 형식)
    if (s.length < 12) return null;
    return new Date(
      parseInt(s.substring(0, 4)),
      parseInt(s.substring(4, 6)) - 1,
      parseInt(s.substring(6, 8)),
      parseInt(s.substring(8, 10)),
      parseInt(s.substring(10, 12)),
    );
  }

  function getTimeLeft(deadline) {
    if (!deadline) return null;
    const target = parseCustomDate(deadline);
    if (!target) return null;
    const diff = target - new Date();
    if (diff <= 0) return "기한 만료";
    const hours = diff / (1000 * 60 * 60);
    if (hours < 1) return `${Math.floor(diff / (1000 * 60))}분 남음`;
    if (hours < 24) return `${Math.floor(hours)}시간 남음`;
    return `${Math.floor(hours / 24)}일 남음`;
  }

  function isDeadlineUrgent(deadline) {
    if (!deadline) return false;
    const target = parseCustomDate(deadline);
    if (!target) return false;
    const diffHours = (target - new Date()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours < 24;
  }

  function getTimeAgo(timestamp) {
    if (!timestamp) return "알 수 없음";
    const target = parseCustomDate(timestamp);
    if (!target) return "알 수 없음";
    const diff = (new Date() - target) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return `${target.getFullYear()}.${String(target.getMonth() + 1).padStart(2, "0")}.${String(target.getDate()).padStart(2, "0")}`;
  }

  function highlightText(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, "gi");
    return text.replace(
      regex,
      '<mark style="background-color: #ffd43b; color: #212529; padding: 0;">$1</mark>',
    );
  }

  function initializeDBWithCoords() {
    const inject = (list) => {
      list.forEach((item) => {
        const baseCoords =
          LOCATION_COORDS[item.location] || LOCATION_COORDS["default"];
        const seedStr = item.timestamp + item.title;
        const coords = getRandomCoords(baseCoords, seedStr);
        item.lat = coords.lat;
        item.lon = coords.lon;

        let cardRoadName = item.location;
        if (window.roadMappingData) {
          const sido = "서울특별시";
          const gu = window.getUpperRegion(item.location).split(" ")[1] || "";
          const key1 = `${sido} ${gu} ${item.location}`;
          const key2 = `${sido} ${gu} ${item.location.replace("제", "")}`;
          let roadArray =
            window.roadMappingData[key1] || window.roadMappingData[key2];

          if (!roadArray) {
            for (const k in window.roadMappingData) {
              if (k.endsWith(" " + item.location)) {
                roadArray = window.roadMappingData[k];
                break;
              }
            }
          }
          if (roadArray && roadArray.length > 0) {
            const hash = getHashFromString(seedStr);
            item.roadAddr = roadArray[hash % roadArray.length];
          } else {
            item.roadAddr = cardRoadName;
          }
        }
      });
    };
    inject(MOCK_DB.products);
    inject(MOCK_DB.requests);
  }

  /* ==========================================================================
     [3] 백엔드 서버를 흉내내는 Mock API
     ========================================================================== */
  const MockAPI = {
    init: async () => {
      try {
        const response = await fetch("http://localhost:8080/api/v1/init-data");
        if (!response.ok) throw new Error("데이터를 불러올 수 없습니다.");
        MOCK_DB = await response.json();
      } catch (error) {
        console.error("초기 데이터 로드 실패:", error);
      }
    },

    fetchFeed: async (viewMode, stateFilters, userContext) => {
      const params = new URLSearchParams({
        viewMode: viewMode,
        category: stateFilters.category,
        keyword: stateFilters.keyword,
        sort: stateFilters.sort,
        lat: userContext.lat,
        lon: userContext.lon
      });
      const response = await fetch(`http://localhost:8080/api/v1/feed?${params}`);
      return await response.json();
    },

    convertToProduct: async (requestId) => {
      const response = await fetch(`http://localhost:8080/api/v1/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: MY_INFO.id })
      });
      if (response.ok) return await response.json();
    },
  };

  /* ==========================================================================
     [4] UI 렌더링 함수군 (HTML 생성)
     ========================================================================== */
  function createProductCardHTML(item, isVerifiedBuyer) {
    const participants = parseInt(item.currentCount || item.participants || 0);
    const maxParticipants = parseInt(item.targetCount || item.maxParticipants || 1);
    const percent = Math.round((participants / maxParticipants) * 100);
    const timeLeft = getTimeLeft(item.deadline);
    const isFullCapacity = item.status === "closed" || percent >= 100;
    const isDeadlinePassed = timeLeft === "기한 만료";

    let displayTimeLeft = timeLeft;
    if (isFullCapacity) displayTimeLeft = "마감됨";

    let progressText = `${participants}명 참여중 (목표 ${maxParticipants}명)`;
    let colorClass = "orange",
      barClass = "";
    if (isFullCapacity) {
      progressText = `${participants}명 참여완료 (모집 종료)`;
      colorClass = "gray";
    } else if (isDeadlinePassed) {
      progressText = `${participants}명 참여중 (목표 ${maxParticipants}명)`;
    } else if (
      percent >= 80 ||
      maxParticipants - participants === 1 ||
      isDeadlineUrgent(item.deadline)
    ) {
      progressText = `마감 직전! ${participants}명 참여중`;
      colorClass = "red";
      barClass = "urgent";
    }

    let badgesHtml = `<div class="badge-group">`;
    if (isFullCapacity)
      badgesHtml += `<span class="product-badge closed">모집완료</span>`;
    else if (
      !isDeadlinePassed &&
      (percent >= 80 ||
        maxParticipants - participants === 1 ||
        isDeadlineUrgent(item.deadline))
    ) {
      badgesHtml += `<span class="product-badge urgent">⚡️ 마감임박</span>`;
    }
    if (item.tags && item.tags.includes("fresh"))
      badgesHtml += `<span class="product-badge fresh">🌱 신선식품</span>`;
    if (item.tags && item.tags.includes("event"))
      badgesHtml += `<span class="product-badge event">🎁 이벤트</span>`;
    badgesHtml += `</div>`;

    let zzimButtonHtml = "";
    if (state.role === "buyer" && !isFullCapacity && !isDeadlinePassed) {
      if (
        !(
          isVerifiedBuyer &&
          (item.myRole === "host" || item.myRole === "participant")
        )
      ) {
        let zzimClass = "";
        if (IS_LOGGED_IN) {
          const wishlist = JSON.parse(
            localStorage.getItem(WISHLIST_KEY) || "[]",
          );
          if (
            wishlist.some(
              (w) => w.timestamp === (item.createdAt || item.timestamp) && w.title === item.title,
            )
          )
            zzimClass = " active";
        }
        zzimButtonHtml = `<button type="button" class="btn-zzim${zzimClass}" title="찜하기">♥</button>`;
      }
    }

    let roleBadgeHtml = "";
    if (IS_LOGGED_IN) {
      if (state.role === "seller" && item.myBid === "true") {
        roleBadgeHtml = isFullCapacity
          ? `<span class="badge-matching completed">🤝 매칭완료</span>`
          : `<span class="badge-matching">📢 매칭중</span>`;
      } else if (state.role === "buyer" && isVerifiedBuyer && item.myRole) {
        if (item.myRole === "host")
          roleBadgeHtml = `<span class="badge-mypost">👑 내가 쓴 글</span>`;
        else if (item.myRole === "participant")
          roleBadgeHtml = isFullCapacity
            ? `<span class="badge-participating completed">🤝 참여완료</span>`
            : `<span class="badge-participating">🙋‍♂️ 참여중</span>`;
      }
    }

    const isRoadState = localStorage.getItem(window.getAddrKey()) === "road";
    const targetDong = item.location.includes(">")
      ? item.location.split(">").pop().trim()
      : item.location;
    let displayAddr = isRoadState ? item.roadAddr || targetDong : targetDong;
    let distStr = "";
    if (
      IS_LOGGED_IN &&
      state.role === "buyer" &&
      item.distance !== null &&
      item.distance !== undefined
    ) {
      distStr = ` (${item.distance >= 1000 ? (item.distance / 1000).toFixed(1) + "km" : item.distance + "m"})`;
    }

    const cardClass = `product-card ${isFullCapacity ? "completed" : ""} ${isDeadlinePassed && !isFullCapacity ? "expired" : ""}`;
    const highlightedTitle = highlightText(item.title, state.keyword);

    const adminBtnHTML =
      state.role === "admin"
        ? `<button class="btn-delete" title="게시글 삭제" onclick="window.adminDelete(event, this)">삭제</button>`
        : "";

    return `
      <article class="${cardClass}" data-id="${item.id}" data-type="product">
        <div class="product-image">
          <img src="${item.image || PRODUCT_IMAGES[(item.id - 1) % PRODUCT_IMAGES.length]}" alt="${item.title}" onerror="this.src='../../images/main/beef.jpg'" />
          ${badgesHtml}
          <div class="product-author">${item.authorNickname || item.author || "익명"}</div>
          ${zzimButtonHtml} ${item.tags && item.tags.includes("event") ? `<div class="event-label">${item.eventText || "이벤트"}</div>` : ""}
        </div>
        <div class="product-info">
          <div class="card-header-row">
            <h3 class="product-title">${highlightedTitle}</h3>
            ${roleBadgeHtml ? `<div class="badge-container">${roleBadgeHtml}</div>` : ""}
          </div>
          <p class="product-meta">
            <strong style="color:#212529;">${item.shopName || item.authorNickname || "인증된 가게"}</strong> · <span class="addr-text">${displayAddr}</span> · ${getTimeAgo(item.createdAt || item.timestamp)}<span class="dist-text">${distStr}</span>
          </p>
          <p class="product-price">${parseInt(item.pricePerPerson || item.price || 0).toLocaleString()}원 ${displayTimeLeft ? `<span style="font-size:11px; color:#fa5252; font-weight:700; margin-left:6px;">⏰ ${displayTimeLeft}</span>` : ""}</p>
          <div class="product-progress">
            <div class="progress-bar"><div class="progress-fill ${barClass}" style="width: ${percent}%"></div></div>
            <p class="progress-text ${colorClass}">${progressText}</p>
          </div>
        </div>
        ${adminBtnHTML}
      </article>
    `;
  }

  function createRequestCardHTML(item, isVerifiedBuyer) {
    let roleBadgeHtml = "";
    if (
      IS_LOGGED_IN &&
      state.role === "buyer" &&
      isVerifiedBuyer &&
      item.myRole
    ) {
      if (item.myRole === "host")
        roleBadgeHtml = `<span class="badge-mypost">👑 내가 쓴 글</span>`;
      else if (item.myRole === "participant")
        roleBadgeHtml = `<span class="badge-participating">🙋‍♂️ 참여중</span>`;
    }

    const isRoadState = localStorage.getItem(window.getAddrKey()) === "road";
    const targetDong = item.location.includes(">")
      ? item.location.split(">").pop().trim()
      : item.location;
    let displayAddr = isRoadState ? item.roadAddr || targetDong : targetDong;
    let distStr = "";
    if (
      IS_LOGGED_IN &&
      state.role === "buyer" &&
      item.distance !== null &&
      item.distance !== undefined
    ) {
      distStr = ` (${item.distance >= 1000 ? (item.distance / 1000).toFixed(1) + "km" : item.distance + "m"})`;
    }

    const highlightedTitle = highlightText(item.title, state.keyword);

    let actionBtnHTML = "";
    if (IS_LOGGED_IN) {
      if (state.role === "seller") {
        if (item.myBid === "true")
          actionBtnHTML = `<button class="btn-bid proposed" disabled>제안중</button>`;
        else
          actionBtnHTML = `<button class="btn-bid" onclick="event.stopPropagation(); alert('입찰 제안 팝업이 열립니다.')">입찰하기</button>`;
      } else if (state.role === "admin") {
        actionBtnHTML = `<button class="btn-delete" title="게시글 삭제" onclick="window.adminDelete(event, this)">삭제</button>`;
      } else if (
        state.role === "buyer" &&
        item.myRole === "host" &&
        item.myBid === "true"
      ) {
        actionBtnHTML = `<button class="btn-accept-bid" onclick="event.stopPropagation(); window.acceptBid('${item.id}')">받은 제안</button>`;
      }
    }

    return `
      <article class="request-card" data-id="${item.id}" data-type="request">
        <div class="card-header-row">
            <h3 class="request-title" style="margin-bottom:0;">${highlightedTitle}</h3>
            ${roleBadgeHtml ? `<div class="badge-container">${roleBadgeHtml}</div>` : ""}
        </div>
        <p class="request-desc">${item.desc}</p>
        <div class="request-footer">
          <span class="request-author">${item.authorNickname || item.author || "익명"}</span>
          <span class="request-budget">희망가: ${item.budget}</span>
          <span class="request-meta">${displayAddr} · ${getTimeAgo(item.createdAt || item.timestamp)}${distStr}</span>
        </div>
        ${actionBtnHTML}
      </article>
    `;
  }

  window.adminDelete = (e, btnElement) => {
    e.stopPropagation();
    const reason = prompt("게시글 삭제 사유를 입력하세요.");
    if (reason && reason.trim()) {
      const card = btnElement.closest("article");
      card.classList.add("admin-deleted");
      card.insertAdjacentHTML(
        "beforeend",
        `
        <div class="admin-deleted-overlay">
            <span style="font-size:30px; margin-bottom:10px;">🛑</span>
            <p style="color:#e03131; font-weight:800; margin-bottom:5px;">관리자에 의해 삭제된 게시물</p>
            <p style="color:#868e96; font-size:12px;">사유: ${reason}</p>
        </div>
      `,
      );
      alert("삭제 처리 완료");
    }
  };

  window.acceptBid = async (reqId) => {
    if (
      confirm(
        "도착한 제안 목록 팝업이 열립니다.\n\n임시 테스트용: 첫 번째 제안을 수락하시겠습니까?",
      )
    ) {
      await MockAPI.convertToProduct(reqId);
      alert("매칭이 시작되었습니다. 모집 중인 공구 탭에서 확인하세요.");
      state.viewMode = "products";
      resetFilters("tab");
      renderRevised();
    }
  };

  /* ==========================================================================
     [5] 메인 비동기 렌더러 (renderRevised)
     ========================================================================== */
  async function renderRevised(isDragAction = false, preventScroll = false) {
    if (state.keyword.length > 0) {
      document.body.classList.add("search-mode");
      if (!isDragAction && !preventScroll)
        window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.body.classList.remove("search-mode");
    }

    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn)
      clearBtn.style.display = state.keyword.length > 0 ? "block" : "none";

    tabBtns.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.view === state.viewMode),
    );

    let disableDistanceSort = !IS_LOGGED_IN || !state.lat || !state.lon;
    if (state.role === "seller" || state.role === "admin") {
      if (sortOptions) sortOptions.style.display = "none";
      if (priceFilterSection) priceFilterSection.style.display = "none";
    } else {
      if (sortOptions) sortOptions.style.display = "flex";
      sortOptionsBtns.forEach((btn) => {
        if (btn.innerText.includes("거리순")) {
          if (disableDistanceSort) {
            btn.classList.add("disabled");
            btn.classList.remove("active");
          } else btn.classList.remove("disabled");
        }
      });
      if (state.sort === "distance" && disableDistanceSort) {
        state.sort = "latest";
        sortOptionsBtns.forEach((b) => b.classList.remove("active"));
        Array.from(sortOptionsBtns)
          .find((b) => b.innerText.includes("최신순"))
          ?.classList.add("active");
      }
      if (priceFilterSection)
        priceFilterSection.style.display =
          state.viewMode === "requests" ? "none" : "block";
    }

    const isRequestMode = state.viewMode === "requests";
    if (isRequestMode) productGrid.classList.add("mode-requests");
    else productGrid.classList.remove("mode-requests");

    const isRoadState = localStorage.getItem(window.getAddrKey()) === "road";
    let displayTitleLoc = "";
    if (state.location) {
      if (state.role === "buyer") {
        const current = JSON.parse(
          localStorage.getItem("udong_buyer_locations") || "[]",
        ).find((l) => l.selected);
        if (current)
          displayTitleLoc =
            isRoadState && current.roadName
              ? current.roadName
              : current.dong || current.name.split(">").pop().trim();
        else displayTitleLoc = state.location.split(">").pop().trim();
      } else {
        const key =
          state.role === "seller"
            ? "udong_seller_location"
            : "udong_admin_location";
        const current = (JSON.parse(localStorage.getItem(key)) || []).find(
          (l) => l.selected,
        );
        const fullPath = current ? current.name : state.location;
        if (isRoadState && typeof window.getMatchedRoadName === "function") {
          displayTitleLoc =
            localStorage.getItem("udong_selected_road_name") ||
            window.getMatchedRoadName(fullPath);
        } else {
          displayTitleLoc = fullPath.split(">").pop().trim();
        }
      }
    }

    let titlePrefix =
      displayTitleLoc && displayTitleLoc !== "전체 지역"
        ? `${displayTitleLoc} `
        : "";
    if (feedTitle) {
      feedTitle.innerText = isRequestMode
        ? `${titlePrefix}${state.role === "seller" || state.role === "admin" ? "구매자들의" : "이웃들의"} 공구 요청`
        : `${titlePrefix}모집 중인 공구`;
    }

    if (feedFilters)
      feedFilters.style.display = isRequestMode ? "none" : "flex";
    if (statusFilterSection)
      statusFilterSection.style.display = isRequestMode ? "none" : "block";
    if (requestWidget)
      requestWidget.style.display = isRequestMode ? "none" : "flex";

    productGrid.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:#868e96; font-weight: bold;">데이터를 불러오는 중입니다... 🚚</div>';

    const currentFilters = {
      category: state.category,
      keyword: state.keyword,
      tags: state.tags,
      statusOnlyActive: state.statusOnlyActive,
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      sort: state.sort,
    };
    const userContext = {
      role: state.role,
      location: state.location,
      lat: state.lat,
      lon: state.lon,
    };
    let isVerifiedBuyer = false;
    if (state.role === "buyer") {
      const locs = JSON.parse(
        localStorage.getItem("udong_buyer_locations") || "[]",
      );
      isVerifiedBuyer = locs.some(
        (l) => l.selected && l.verified && !l.expired,
      );
    } else {
      isVerifiedBuyer = true;
    }

    try {
      const responseData = await MockAPI.fetchFeed(
        state.viewMode,
        currentFilters,
        userContext,
      );
      productGrid.innerHTML = "";

      if (responseData.length === 0) {
        showEmptyState(
          state.keyword
            ? `'${state.keyword}'의 검색 결과가 없습니다.`
            : "조건에 맞는 공구가 없습니다.",
          true,
        );
      } else {
        const htmlChunks = responseData.map((item) =>
          isRequestMode
            ? createRequestCardHTML(item, isVerifiedBuyer)
            : createProductCardHTML(item, isVerifiedBuyer),
        );
        productGrid.innerHTML = htmlChunks.join("");
      }
    } catch (e) {
      productGrid.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:#e03131;">서버와 통신할 수 없습니다.</div>';
    }

    updateSideWidget();
  }

  /* ==========================================================================
     [6] 사이드바 위젯 로직
     ========================================================================== */
  function updateSideWidget() {
    const widgetContainer = document.querySelector(
      ".sidebar-right .widget.highlighted",
    );
    if (!widgetContainer) return;

    if (!IS_LOGGED_IN) {
      widgetContainer.innerHTML = `
        <h3 class="widget-title">📦 배송비 0원 챌린지!</h3>
        <div class="login-promo-box">
            <div class="promo-icon">🚚</div>
            <p class="promo-title">이웃과 함께 나누면<br>배송비가 0원!</p>
            <p class="promo-desc">지금 바로 로그인하고<br>우리 동네 공구에 참여해보세요.</p>
            <button class="btn-join" onclick="location.href='../Login.html'">로그인하기</button>
        </div>`;
    } else if (state.role === "admin") {
      widgetContainer.innerHTML = `
        <h3 class="widget-title">🛑 회원 제재 관리</h3>
        <div class="admin-ban-panel" style="margin-top:10px;">
          <input type="text" id="adminBanUser" class="admin-input" placeholder="닉네임 입력" style="margin-bottom:5px;">
          <select id="adminBanReason" class="admin-input" style="margin-bottom:5px;">
            <option value="" disabled selected>제재 사유 선택</option><option value="abuse">욕설 및 비방 (Abuse)</option><option value="scam">거래 사기 (Scam)</option><option value="spam">도배 및 광고 (Spam)</option><option value="noshow">거래 파기/노쇼 (No-show)</option>
          </select>
          <select id="adminBanLevel" class="admin-input" style="margin-bottom:10px;">
            <option value="" disabled selected>제재 단계 선택</option><option value="warning">1차 경고 (Warning)</option><option value="suspend_7d">7일 이용 정지 (7d Suspend)</option><option value="suspend_30d">30일 이용 정지 (30d Suspend)</option><option value="ban_permanent">영구 정지 (Permanent Ban)</option>
          </select>
          <button class="btn-ban" onclick="alert('제재 처리 완료');" style="width:100%; background:#e03131; color:white; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer; border:none;">제재 실행</button>
        </div>`;
    } else if (state.role === "seller") {
      let inProgressCount = MOCK_DB.requests.filter(
        (r) => r.myBid === "true",
      ).length;
      let successCount = 0,
        totalSales = 0;
      MOCK_DB.products.forEach((p) => {
        if (p.myBid === "true" || p.author === "매칭완료") {
          successCount++;
          if (
            p.status === "closed" ||
            parseInt(p.participants) >= parseInt(p.maxParticipants)
          ) {
            totalSales += parseInt(p.price || "0");
          }
        }
      });
      const settlementAmount = Math.floor(totalSales * 0.95);
      widgetContainer.innerHTML = `
        <h3 class="widget-title">📊 판매자 현황</h3>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
            <div style="display:flex; justify-content:space-between; font-size:14px;"><span>진행중인 입찰</span><span style="font-weight:700; color:#4c6ef5;">${inProgressCount}건</span></div>
            <div style="display:flex; justify-content:space-between; font-size:14px;"><span>이번 달 낙찰</span><span style="font-weight:700;">${successCount}건</span></div>
            <hr style="border:none; border-top:1px solid #eee; margin:5px 0;">
            <div><p class="savings-label">이번 달 정산 예정금</p><p class="savings-amount" style="font-size:22px;">${settlementAmount > 0 ? settlementAmount.toLocaleString() + "원" : "0원"}</p></div>
        </div>
        <button class="widget-button" onclick="location.href='/html/mypage/partner_settlement.html'">자세히 보기</button>`;
    } else {
      widgetContainer.innerHTML = `<h3 class="widget-title"> 나의 참여 현황</h3><div class="participation-item"></div><hr style="border: none; border-top: 1px solid #f1f3f5; margin: 16px 0;" /><div><p class="savings-label">이번 달 아낀 배송비</p><p class="savings-amount">0원 💰</p></div><button class="widget-button" onclick="location.href='/html/mypage/buyer_delivery.html'">자세히 보기</button>`;
      updateBuyerWidget(widgetContainer);
    }
    updateRequestWidget();
  }

  function updateBuyerWidget(container) {
    const partItem = container.querySelector(".participation-item");
    const detailBtn = container.querySelector(".widget-button");
    const savingsEl = container.querySelector(".savings-amount");
    const verifiedLocs = (
      JSON.parse(localStorage.getItem("udong_buyer_locations")) || []
    ).filter((l) => l.verified && !l.expired);

    if (verifiedLocs.length === 0) {
      partItem.innerHTML = `<div class="participation-info" style="width:100%; text-align:center; color:#868e96; padding:10px 0;">동네 인증 후<br>확인할 수 있습니다.</div>`;
      detailBtn.disabled = true;
      return;
    }

    const myProducts = MOCK_DB.products.filter(
      (p) => p.myRole === "host" || p.myRole === "participant",
    );
    const totalSavings = myProducts
      .filter((p) => p.status === "closed")
      .reduce((sum, p) => sum + parseInt(p.shippingCost || 3000), 0);
    if (savingsEl)
      savingsEl.innerText = `${totalSavings.toLocaleString()}원 💰`;

    const activeProducts = myProducts
      .filter((p) => p.status === "active")
      .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));
    if (activeProducts.length > 0) {
      const target = activeProducts[0];
      partItem.style.cursor = "pointer";
      partItem.onclick = () => (location.href = "../post/post-detail.html");
      partItem.innerHTML = `<div class="participation-icon" style="overflow:hidden; border:1px solid #eee; padding:0;"><img src="${target.image}" style="width:100%; height:100%; object-fit:cover;"></div><div class="participation-info"><p class="participation-title" style="font-weight:700; font-size:15px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${target.title}</p><p class="participation-status" style="font-size:12px; color:#ff6f0f; font-weight:700;">매칭 진행중 (${target.participants}/${target.maxParticipants}명)</p></div>`;
      detailBtn.disabled = false;
    } else {
      partItem.innerHTML = `<div class="participation-icon" style="background:#f1f3f5; font-size:20px;">😴</div><div class="participation-info"><p class="participation-title" style="color:#495057;">참여 중인 공구가 없습니다</p></div>`;
    }
  }

  function updateRequestWidget() {
    const widget = document.getElementById("requestWidget");
    if (!widget) return;
    const listContainer = widget.querySelector(".request-list");
    const title = widget.querySelector(".widget-title");
    const writeBtn = widget.querySelector(".request-submit-btn");

    if (writeBtn)
      writeBtn.style.display =
        state.role === "seller" || state.role === "admin" ? "none" : "block";
    if (title)
      title.innerText =
        state.role === "seller" || state.role === "admin"
          ? "📢 구매자들의 공구 요청"
          : "📢 이웃들의 공구 요청";
    if (!listContainer) return;

    let reqs = [...MOCK_DB.requests]
      .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
      .slice(0, 5);
    listContainer.innerHTML = "";
    if (reqs.length === 0) {
      listContainer.innerHTML = `<li style="padding:15px; text-align:center; color:#868e96; font-size:13px;">등록된 요청이 없습니다.</li>`;
      return;
    }

    reqs.forEach((req) => {
      let time = getTimeAgo(req.timestamp);
      listContainer.insertAdjacentHTML(
        "beforeend",
        `<li class="request-item" onclick="window.location.href='../post/request-detail.html'"><span class="request-text" style="font-size:13px;">${req.title}</span><span class="request-time">${time}</span></li>`,
      );
    });
  }

  /* ==========================================================================
     [7] 검색 및 기타 이벤트 핸들러
     ========================================================================== */
  function performSearch() {
    const input = document.getElementById("searchInput");
    if (!input) return;
    state.keyword = input.value.trim().toLowerCase();
    if (state.keyword) saveSearchHistory(state.keyword);

    document
      .getElementById("searchHistoryLayer")
      ?.style.setProperty("display", "none");
    resetFilters("search");

    const prodCount = MOCK_DB.products.filter((p) =>
      p.title.toLowerCase().includes(state.keyword),
    ).length;
    const reqCount = MOCK_DB.requests.filter((r) =>
      r.title.toLowerCase().includes(state.keyword),
    ).length;
    if (state.viewMode === "products" && prodCount === 0 && reqCount > 0)
      state.viewMode = "requests";
    else if (state.viewMode === "requests" && reqCount === 0 && prodCount > 0)
      state.viewMode = "products";

    renderRevised(false, false);
  }

  function resetFilters(mode = "full") {
    state.category = "all";
    state.tags = [];
    state.statusOnlyActive = false;
    state.priceMin = 0;
    state.priceMax = MAX_PRICE;
    categoryBtns.forEach((b) => b.classList.remove("active"));
    document
      .querySelector('.category-item[data-category="all"]')
      ?.classList.add("active");
    if (categoryList) categoryList.scrollTo({ top: 0, behavior: "smooth" });
    tagBtns.forEach((b) => b.classList.remove("active"));
    if (toggleStatus) toggleStatus.checked = false;
    initSlider();

    if (mode === "full") {
      state.keyword = "";
      if (document.getElementById("searchInput"))
        document.getElementById("searchInput").value = "";
      state.viewMode = "products";
    }
    state.sort = "latest";
    sortOptionsBtns.forEach((o) => o.classList.remove("active"));
    Array.from(sortOptionsBtns)
      .find((o) => o.innerText.includes("최신순"))
      ?.classList.add("active");
  }

  function showEmptyState(msg, showBtn) {
    const html = `<div id="no-result-msg" class="no-result-msg"><div style="font-size:48px; margin-bottom:10px;">😢</div><p>${msg}</p>${showBtn ? `<button id="resetAllBtn" style="margin-top:15px; padding:8px 16px; border:none; background:#f1f3f5; border-radius:4px; cursor:pointer; font-weight:bold;">전체 목록 보기</button>` : ""}</div>`;
    productGrid.innerHTML = html;
    if (showBtn)
      document.getElementById("resetAllBtn").addEventListener("click", () => {
        resetFilters("full");
        renderRevised();
      });
  }

  function updateLocation() {
    let myLat = null,
      myLon = null;
    if (IS_LOGGED_IN) {
      if (state.role === "seller" || state.role === "admin") {
        const key =
          state.role === "seller"
            ? "udong_seller_location"
            : "udong_admin_location";
        const target = (JSON.parse(localStorage.getItem(key)) || []).find(
          (l) => l.selected,
        );
        if (target && target.name !== "전체 지역") {
          state.location = target.name.split(">").pop().trim();
          myLat = target.lat;
          myLon = target.lon;
        } else state.location = null;
      } else {
        const target = (
          JSON.parse(localStorage.getItem("udong_buyer_locations")) || []
        ).find((l) => l.selected);
        if (target && target.verified && !target.expired) {
          state.location = target.name;
          myLat = target.lat;
          myLon = target.lon;
        } else state.location = null;
      }
    } else {
      state.location = null;
    }

    state.lat = myLat;
    state.lon = myLon;
    const writeBtn = document.querySelector(".request-submit-btn");
    if (writeBtn) {
      if (IS_LOGGED_IN && state.role === "buyer" && !state.location) {
        writeBtn.disabled = true;
        writeBtn.innerText = "동네 인증 필요";
      } else {
        writeBtn.disabled = false;
        writeBtn.innerText = "나도 요청글 쓰기";
      }
    }
    resetFilters("full");
    renderRevised();
    renderRecentWidget();
  }

  /* ==========================================================================
     [8] 이벤트 리스너 및 잡다한 헬퍼
     ========================================================================== */
  function getRecentItemsKey() {
    if (!IS_LOGGED_IN) return "udong_recent_items_guest";
    if (state.role === "admin") return "udong_recent_items_admin";
    if (state.role === "seller") return "udong_recent_items_seller";
    return "udong_recent_items_buyer";
  }

  function saveRecentItem(itemData) {
    if (!IS_LOGGED_IN) return;
    const key = getRecentItemsKey();
    let items = JSON.parse(localStorage.getItem(key) || "[]").filter(
      (i) => i.id !== itemData.id,
    );
    items.unshift(itemData);
    if (items.length > 5) items.pop();
    localStorage.setItem(key, JSON.stringify(items));
  }

  function renderRecentWidget() {
    if (!recentItemsList) return;
    if (!IS_LOGGED_IN) {
      recentItemsList.innerHTML = `<div class="recent-item" style="cursor: default; width:100%; border:none; background:none;"><div class="recent-placeholder" style="width:100%; text-align:center; font-size:12px; color:#868e96; padding:10px 0; line-height:1.4;">로그인 후<br>최근 본 공구가<br>표시됩니다.</div></div>`;
      if (btnClearRecent) btnClearRecent.style.display = "none";
      return;
    }
    if (btnClearRecent) btnClearRecent.style.display = "inline-block";
    let items = JSON.parse(localStorage.getItem(getRecentItemsKey()) || "[]");
    recentItemsList.innerHTML = "";
    if (items.length === 0) {
      recentItemsList.innerHTML = `<div class="recent-item" style="cursor: default; width:100%; border:none; background:none;"><div class="recent-placeholder" style="width:100%; text-align:center; font-size:13px; color:#868e96; padding:10px 0; line-height:1.4;">최근 본 공구가<br>없습니다.</div></div>`;
    } else {
      items.slice(0, 3).forEach((item) => {
        recentItemsList.insertAdjacentHTML(
          "beforeend",
          `<div class="recent-item" title="${item.title}" onclick="window.location.href='../post/post-detail.html'"><img src="${item.image}"></div>`,
        );
      });
    }
  }

  if (btnClearRecent)
    btnClearRecent.addEventListener("click", () => {
      localStorage.removeItem(getRecentItemsKey());
      renderRecentWidget();
    });

  tabBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      const targetMode = btn.dataset.view;
      if (state.viewMode !== targetMode) {
        resetFilters("tab");
        state.viewMode = targetMode;
        renderRevised(false, true);
      }
    }),
  );

  categoryBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      categoryBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.category = btn.dataset.category;
      renderRevised(false, true);
    }),
  );

  tagBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      const val = btn.dataset.tag;
      const idx = state.tags.indexOf(val);
      if (idx > -1) {
        state.tags.splice(idx, 1);
        btn.classList.remove("active");
      } else {
        state.tags.push(val);
        btn.classList.add("active");
      }
      renderRevised(false, true);
    }),
  );

  if (toggleStatus)
    toggleStatus.addEventListener("change", (e) => {
      state.statusOnlyActive = e.target.checked;
      renderRevised(false, true);
    });

  sortOptionsBtns.forEach((opt) =>
    opt.addEventListener("click", (e) => {
      if (opt.classList.contains("disabled")) {
        e.preventDefault();
        return;
      }
      sortOptionsBtns.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      state.sort = opt.innerText.includes("거리") ? "distance" : "latest";
      renderRevised(false, true);
    }),
  );

  function initSearchHistory() {
    const input = document.getElementById("searchInput");
    const layer = document.getElementById("searchHistoryLayer");
    const list = document.getElementById("searchHistoryList");
    if (!input || !layer || !list) return;

    const render = () => {
      const history = JSON.parse(
        localStorage.getItem(SEARCH_HISTORY_KEY) || "[]",
      );
      list.innerHTML = "";
      if (history.length === 0) {
        list.innerHTML = `<li class="no-history">최근 검색어가 없습니다.</li>`;
        return;
      }
      history.forEach((k, i) => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.innerHTML = `<span class="history-text">${k}</span><button type="button" class="btn-delete-history">✕</button>`;
        li.querySelector(".history-text").addEventListener("click", () => {
          input.value = k;
          performSearch();
        });
        li.querySelector(".btn-delete-history").addEventListener(
          "click",
          (e) => {
            e.stopPropagation();
            history.splice(i, 1);
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
            input.focus();
            render();
          },
        );
        list.appendChild(li);
      });
    };
    input.addEventListener("focus", () => {
      render();
      layer.style.display = "block";
    });
    document.addEventListener("click", (e) => {
      if (!layer.contains(e.target) && e.target !== input)
        layer.style.display = "none";
    });
    document
      .getElementById("btnDeleteAllHistory")
      ?.addEventListener("click", () => {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        render();
      });
  }

  function saveSearchHistory(keyword) {
    let history = JSON.parse(
      localStorage.getItem(SEARCH_HISTORY_KEY) || "[]",
    ).filter((k) => k !== keyword);
    history.unshift(keyword);
    if (history.length > 10) history.pop();
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }

  document.addEventListener("keydown", (e) => {
    if (e.target?.id === "searchInput" && e.key === "Enter") {
      e.preventDefault();
      performSearch();
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#searchBtn")) {
      e.preventDefault();
      performSearch();
    }
    if (e.target.closest("#searchClearBtn")) {
      e.preventDefault();
      resetFilters("full");
      renderRevised();
    }
    if (e.target.closest(".request-submit-btn")) {
      if (!IS_LOGGED_IN) {
        if (confirm("로그인이 필요합니다."))
          location.href = '../Login.html';
      } else if (state.role === "buyer" && !state.location)
        alert("동네 인증이 필요합니다.");
    }
  });

  productGrid.addEventListener("click", (e) => {
    const card = e.target.closest("article");
    if (!card) return;

    if (!IS_LOGGED_IN) {
      if (e.target.closest(".btn-zzim, .btn-bid, .btn-accept-bid") || card) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("로그인이 필요한 서비스입니다.\n로그인하시겠습니까?"))
          location.href = '../Login.html';
        return;
      }
    }

    if (
      e.target.classList.contains("btn-delete") ||
      e.target.classList.contains("btn-accept-bid") ||
      e.target.classList.contains("btn-bid")
    )
      return;
    if (
      card.classList.contains("expired") ||
      card.classList.contains("admin-deleted")
    )
      return;

    const zzimBtn = e.target.closest(".btn-zzim");
    const dId = card.dataset.id;
    const isRequest = card.dataset.type === "request";
    const itemData = isRequest
      ? MOCK_DB.requests.find((r) => r.id === dId)
      : MOCK_DB.products.find((p) => p.id === dId);

    if (zzimBtn && !isRequest) {
      e.preventDefault();
      e.stopPropagation();
      let wishlist = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      const idx = wishlist.findIndex(
        (w) => w.timestamp === itemData.timestamp && w.title === itemData.title,
      );
      if (idx > -1) {
        wishlist.splice(idx, 1);
        zzimBtn.classList.remove("active");
      } else {
        wishlist.unshift({
          title: itemData.title,
          timestamp: itemData.createdAt || itemData.timestamp,
          location: itemData.location,
          lat: itemData.lat,
          lon: itemData.lon,
        });
        zzimBtn.classList.add("active");
      }
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
      return;
    }

    if (isRequest) {
      localStorage.setItem("current_request", JSON.stringify(itemData));
      window.location.href = "../post/request-detail.html";
    } else {
      saveRecentItem({
        id: itemData.id,
        title: itemData.title,
        image: itemData.image,
        fullData: itemData,
      });
      localStorage.setItem("current_post", JSON.stringify(itemData));
      window.location.href = "../post/post-detail.html";
    }
  });

  window.addEventListener("addrTypeChange", () => renderRevised(false, true));
  window.addEventListener("locationChange", () => {
    updateLocation();
  });

  function initSlider() {
    if (!sliderTrack) return;
    function updateUI() {
      const minP = (state.priceMin / MAX_PRICE) * 100,
        maxP = (state.priceMax / MAX_PRICE) * 100;
      if (handleMin) handleMin.style.left = minP + "%";
      if (handleMax) handleMax.style.left = maxP + "%";
      if (progress) {
        progress.style.left = minP + "%";
        progress.style.width = maxP - minP + "%";
      }
      document.getElementById("labelMin").innerText =
        state.priceMin.toLocaleString() + "원";
      document.getElementById("labelMax").innerText =
        state.priceMax.toLocaleString() + "원";
    }
    function handleDrag(e, isMin) {
      const rect = sliderTrack.getBoundingClientRect();
      let per = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      );
      let val = Math.round(((per / 100) * MAX_PRICE) / 1000) * 1000;
      if (isMin) state.priceMin = Math.min(val, state.priceMax - 1000);
      else state.priceMax = Math.max(val, state.priceMin + 1000);
      updateUI();
      renderRevised(true);
    }
    function addList(el, isMin) {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.body.classList.add("is-dragging");
        const mv = (ev) => handleDrag(ev, isMin),
          up = () => {
            document.body.classList.remove("is-dragging");
            document.removeEventListener("mousemove", mv);
            document.removeEventListener("mouseup", up);
          };
        document.addEventListener("mousemove", mv);
        document.addEventListener("mouseup", up);
      });
    }
    if (handleMin) addList(handleMin, true);
    if (handleMax) addList(handleMax, false);
    updateUI();
  }

  /* ==========================================================================
     [9] 초기 실행 (Bootstrap)
     ========================================================================== */
  const boot = async () => {
    await MockAPI.init();
    initializeDBWithCoords();
    initSlider();
    updateLocation();
    initSearchHistory();
  };

  if (typeof window.loadRoadData === "function") {
    window.loadRoadData(() => boot());
  } else {
    boot();
  }
});