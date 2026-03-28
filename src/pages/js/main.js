document.addEventListener("DOMContentLoaded", () => {
  const IS_LOGGED_IN = localStorage.getItem("udong_is_logged_in") === "true";
  const USER_ROLE = localStorage.getItem("udong_user_role") || "buyer";
  let MY_INFO = { nickname: "익명" };
  try {
    const saved = localStorage.getItem("udong_user_info");
    if (saved) MY_INFO = JSON.parse(saved);
  } catch (e) {
    console.warn("사용자 정보 파싱 실패, 기본값을 사용합니다.");
  }

  if (IS_LOGGED_IN) {
    document.body.classList.add(`role-${USER_ROLE}`);
  }

  const MAX_PRICE = 100000;

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

  // [추가] 청크 단위 무한 스크롤 상태 관리 변수
  let chunkPage = 1;
  let isFetchingNextChunk = false;
  let hasMoreChunks = true;

  // [추가] 무한 스크롤 이벤트 리스너
  window.addEventListener("scroll", () => {
    if (isFetchingNextChunk || !hasMoreChunks) return;

    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;

    // 바닥에 거의 다다랐을 때 (여백 200px) 다음 데이터 100개(청크) 요청
    if (Math.ceil(scrolled) + 200 >= scrollable) {
      chunkPage++;
      renderRevised(false, true, true); // 세 번째 인자 isLoadMore = true 로 전달
    }
  });

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

  function parseCustomDate(str) {
    if (!str || String(str).length < 12) return null;
    const s = String(str);
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

  /* ==========================================================================
     [3] 백엔드 서버를 흉내내는 Mock API (백엔드 연동 대비용)
     ========================================================================== */
  const FeedAPI = {
    init: async () => {
      // 리팩토링: 데이터 로드 및 가공 권한을 UdongAPI로 완전히 넘김
      // await UdongAPI.initFeedData();
    },
    fetchFeed: async (viewMode, stateFilters, userContext) => {
      return await UdongAPI.getFeed(viewMode, stateFilters, userContext);
    },
  };

  /* ==========================================================================
     [4] UI 렌더링 함수군 (HTML 생성)
     ========================================================================== */
  function createProductCardHTML(item, isVerifiedBuyer) {
    const participants = parseInt(item.participants || 0);
    const maxParticipants = parseInt(item.maxParticipants || 1);
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
      // ★ BFF 아키텍처 적용: 프론트엔드의 계산식(isDeadlineUrgent 등)을 버리고 Worker의 isUrgent 값을 사용
    } else if (item.isUrgent === true && item.status === "active") {
      progressText = `마감 직전! ${participants}명 참여중`;
      colorClass = "red";
      barClass = "urgent";
    }

    let badgesHtml = `<div class="badge-group">`;
    if (isFullCapacity)
      badgesHtml += `<span class="product-badge closed">모집완료</span>`;
    // ★ BFF 아키텍처 적용: 마감임박 계산을 Worker에 위임
    else if (item.isUrgent === true && item.status === "active") {
      badgesHtml += `<span class="product-badge urgent">⚡️ 마감임박</span>`;
    }
    if (item.tags && item.tags.includes("fresh"))
      badgesHtml += `<span class="product-badge fresh">🌱 신선식품</span>`;
    if (item.tags && item.tags.includes("event"))
      badgesHtml += `<span class="product-badge event">🎁 이벤트</span>`;
    badgesHtml += `</div>`;

    let zzimButtonHtml = "";
    if (state.role === "buyer" && !isFullCapacity && !isDeadlinePassed) {
      // 내가 쓴 글이나 이미 참여한 글이 아닐 때만 찜 버튼 노출
      if (!(item.myRole === "host" || item.myRole === "participant")) {
        let zzimClass = item.isWished ? " active" : "";
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
    let displayAddr = item.location;

    // ★ [원상복구] 사용자가 고생해서 짜둔 완벽한 도로명 조합 로직 되살림
    if (isRoadState) {
      if (item.roadAddr) displayAddr = item.roadAddr;
      else if (typeof window.getMatchedRoadName === "function") {
        displayAddr = window.getMatchedRoadName(item.location);
      }
    } else if (item.location.includes(">")) {
      displayAddr = item.location.split(">").pop().trim();
    }

    let distStr = "";
    if (
      IS_LOGGED_IN &&
      state.role === "buyer" &&
      item.distance !== null &&
      item.distance !== undefined
    ) {
      const d = Math.round(item.distance); // ★ 소수점 제거 (반올림)
      if (d === 0) distStr = "";
      else distStr = ` (${d >= 1000 ? (d / 1000).toFixed(1) + "km" : d + "m"})`;
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
          <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/300x200?text=이미지없음'" />
          ${badgesHtml}
          <div class="product-author">${item.author || "익명"}</div>
          ${zzimButtonHtml} ${item.eventText ? `<div class="event-label">${item.eventText}</div>` : ""}
        </div>
        <div class="product-info">
          <div class="card-header-row">
            <h3 class="product-title">${highlightedTitle}</h3>
            ${roleBadgeHtml ? `<div class="badge-container">${roleBadgeHtml}</div>` : ""}
          </div>
          <p class="product-meta">
            <strong style="color:#212529;">${item.shopName || "인증된 가게"}</strong> · <span class="addr-text">${displayAddr}</span> · ${getTimeAgo(item.timestamp)}<span class="dist-text">${distStr}</span>
          </p>
          <p class="product-price">${parseInt(item.price).toLocaleString()}원 ${displayTimeLeft ? `<span style="font-size:11px; color:#fa5252; font-weight:700; margin-left:6px;">⏰ ${displayTimeLeft}</span>` : ""}</p>
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
    let displayAddr = item.location;

    if (isRoadState) {
      if (item.roadAddr) displayAddr = item.roadAddr;
      else if (typeof window.getMatchedRoadName === "function") {
        displayAddr = window.getMatchedRoadName(item.location);
      }
    } else if (item.location.includes(">")) {
      displayAddr = item.location.split(">").pop().trim();
    }

    let distStr = "";
    if (
      IS_LOGGED_IN &&
      state.role === "buyer" &&
      item.distance !== null &&
      item.distance !== undefined
    ) {
      const d = Math.round(item.distance);
      if (d === 0) distStr = "";
      else distStr = ` (${d >= 1000 ? (d / 1000).toFixed(1) + "km" : d + "m"})`;
    }

    const timeLeft = getTimeLeft(item.deadline);
    let displayTimeLeft = "";
    let isCanceledOrExpired = false;

    if (item.status === "request_canceled") {
      displayTimeLeft = `<span style="color:#fa5252; font-weight:800; margin-left:8px; font-size:12px;">요청 취소</span>`;
      isCanceledOrExpired = true;
    } else if (item.status === "expired" || timeLeft === "기한 만료") {
      displayTimeLeft = `<span style="color:#fa5252; font-weight:800; margin-left:8px; font-size:12px;">⏰ 기한 만료</span>`;
      isCanceledOrExpired = true;
    } else if (timeLeft) {
      displayTimeLeft = `<span style="color:#fa5252; font-weight:800; margin-left:8px; font-size:12px;">⏰ ${timeLeft}</span>`;
    }

    const hasActionBtn =
      IS_LOGGED_IN && (state.role === "seller" || state.role === "admin");
    const rightMargin = hasActionBtn ? "-90px" : "0";

    const currentBidders = item.biddingSellers || 0;
    let receivedBidsHTML = "";
    if (IS_LOGGED_IN) {
      if (state.role === "buyer") {
        receivedBidsHTML = `<span style="flex-shrink:0; white-space:nowrap; font-size:12px; color:#495057; font-weight:700; background:#f8f9fa; padding:4px 8px; border-radius:4px; margin-right:${rightMargin};">제안 <span style="color:var(--primary)">${currentBidders}</span>/10</span>`;
      } else if (state.role === "seller") {
        receivedBidsHTML = `<span style="flex-shrink:0; white-space:nowrap; font-size:12px; color:#495057; font-weight:700; background:#f8f9fa; padding:4px 8px; border-radius:4px; margin-right:${rightMargin};">입찰 <span style="color:var(--seller-blue)">${currentBidders}</span>/10</span>`;
      }
    }

    const highlightedTitle = highlightText(item.title, state.keyword);
    let actionBtnHTML = "";

    if (IS_LOGGED_IN) {
      if (state.role === "seller") {
        if (item.myBid === "true" || item.myBid === true) {
          actionBtnHTML = `<button class="btn-bid proposed" disabled>제안 완료</button>`;
        } else if (!isCanceledOrExpired) {
          actionBtnHTML = `<button class="btn-bid" onclick="event.stopPropagation(); window.openBidModal('${item.id}', '${item.title.replace(/'/g, "\\'")}')">입찰하기</button>`;
        }
      } else if (state.role === "admin") {
        actionBtnHTML = `<button class="btn-delete" title="게시글 삭제" onclick="event.stopPropagation(); window.adminDelete(event, this)">삭제</button>`;
      }
    }

    const cardClass = `request-card ${isCanceledOrExpired ? "expired" : ""}`;
    const contentOpacity = isCanceledOrExpired ? "opacity: 0.5;" : "";

    return `
      <article class="${cardClass}" data-id="${item.id}" data-type="request" style="cursor: pointer; position: relative;" onclick="location.href='../post/detail.html?id=${item.id}&type=request'">
        <div style="${contentOpacity}">
          <div class="card-header-row">
              <h3 class="request-title" style="margin-bottom:0;">${highlightedTitle}</h3>
              ${roleBadgeHtml ? `<div class="badge-container">${roleBadgeHtml}</div>` : ""}
          </div>
          <p class="request-desc">${item.desc}</p>
          <div class="request-footer">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:6px;">
              <div style="display:flex; align-items:center; min-width:0; overflow:hidden;">
                <span class="request-author" style="margin-bottom:0; flex-shrink:0;">${item.author || "익명"}</span>
                ${displayTimeLeft}
              </div>
              ${receivedBidsHTML}
            </div>
            <span class="request-budget">1인당 희망가: ${item.budget}</span>
            <span class="request-meta">${displayAddr} · ${getTimeAgo(item.timestamp)}${distStr}</span>
          </div>
        </div>
        ${actionBtnHTML}
      </article>
    `;
  }

  window.adminDelete = async (e, btnElement) => {
    e.stopPropagation();
    const reason = prompt("게시글 삭제 사유를 입력하세요.");
    if (reason && reason.trim()) {
      const card = btnElement.closest("article");
      const postId = card.dataset.id;

      // [대청소] 작성자(구매자 또는 판매자) 이름 추출 (서버에 알림 대상 정보로 전달 위함)
      const authorNode =
        card.querySelector(".product-author") ||
        card.querySelector(".request-author");
      const author = authorNode ? authorNode.innerText : "익명";

      // [대청소] UdongAPI.deletePost에 작성자 닉네임(author)을 추가 파라미터로 넘깁니다.
      const isSuccess = await UdongAPI.deletePost(postId, reason, author);

      if (isSuccess) {
        card.classList.add("admin-deleted");
        card.insertAdjacentHTML(
          "beforeend",
          `<div class="admin-deleted-overlay">
              <span style="font-size:30px; margin-bottom:10px;">🛑</span>
              <p style="color:#e03131; font-weight:800; margin-bottom:5px;">관리자에 의해 삭제된 게시물</p>
              <p style="color:#868e96; font-size:12px;">사유: ${reason}</p>
          </div>`,
        );

        // [대청소 완료] udong_noti_... 로컬스토리지 저장 로직 완전 삭제 (서버에서 KV로 자동 동기화됨)
        alert("삭제 처리 및 알림 발송 완료 (서버 동기화)");
      } else {
        alert("서버 오류로 인해 삭제에 실패했습니다.");
      }
    }
  };

  // =========================================================================
  // [추가] 관리자 제재 실행 함수 (API 호출용)
  // =========================================================================
  window.executeSanction = async () => {
    const nickname = document.getElementById("adminBanUser")?.value;
    const reason = document.getElementById("adminBanReason")?.value;
    const level = document.getElementById("adminBanLevel")?.value;

    if (!nickname || !reason || !level) {
      alert("제재 대상 닉네임, 사유, 단계를 모두 선택해주세요.");
      return;
    }

    const success = await UdongAPI.sanctionUser(nickname, reason, level);

    if (success) {
      // [대청소] 로컬 알림 생성 로직 완전 삭제 (서버에서 자동 처리됨)

      // 1. 입력창 초기화
      document.getElementById("adminBanUser").value = "";
      document.getElementById("adminBanReason").value = "";
      document.getElementById("adminBanLevel").value = "";

      // 3. 만약 제재 대상이 현재 로그인한 본인이라면 닉네임, 드롭박스 즉시 초기화
      if (MY_INFO.nickname === nickname) {
        localStorage.removeItem("udong_user_info");
        const userMenu = document.getElementById("userMenuContainer");
        if (userMenu) {
          userMenu.querySelector(".user-nickname").innerText = "제재된 사용자";
          document
            .getElementById("userMenuDropdown")
            ?.classList.remove("active");
        }
      }

      alert(`${nickname}님에 대한 제재 처리가 완료되었습니다.`);
    } else {
      alert("제재 처리 중 서버 오류가 발생했습니다.");
    }
  };

  // [추가] 내 주변 네모 박스(Bounding Box) 계산 함수
  function getSearchBoundingBox(lat, lon, regionName) {
    if (!lat || !lon || !regionName) return null;
    // 도심(서울, 경기, 광역시)은 3km, 지방은 5km로 설정
    const isUrban = [
      "서울",
      "경기",
      "부산",
      "인천",
      "대구",
      "대전",
      "광주",
    ].some((city) => regionName.includes(city));
    const radiusKm = isUrban ? 3 : 5;

    const latToKm = 111.32;
    const lonToKm = (40075 * Math.cos((lat * Math.PI) / 180)) / 360;

    return {
      minLat: lat - radiusKm / latToKm,
      maxLat: lat + radiusKm / latToKm,
      minLon: lon - radiusKm / lonToKm,
      maxLon: lon + radiusKm / lonToKm,
      radiusLimit: radiusKm * 1000,
    };
  }

  /* ==========================================================================
     [5] 메인 비동기 렌더러 (renderRevised)
     ========================================================================== */
  // [수정] isLoadMore 파라미터 추가
  async function renderRevised(
    isDragAction = false,
    preventScroll = false,
    isLoadMore = false,
  ) {
    if (state.keyword.length > 0) {
      document.body.classList.add("search-mode");
      if (!isDragAction && !preventScroll && !isLoadMore)
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
      const locs = await UdongAPI.getUserLocations(state.role);
      const current = locs.find((l) => l.selected);

      if (current) {
        if (state.role === "buyer") {
          displayTitleLoc =
            isRoadState && current.roadName
              ? current.roadName
              : current.dong || current.name.split(">").pop().trim();
        } else {
          const fullPath = current.name;
          if (isRoadState && typeof window.getMatchedRoadName === "function") {
            displayTitleLoc =
              localStorage.getItem("udong_selected_road_name") ||
              window.getMatchedRoadName(fullPath);
          } else {
            displayTitleLoc = fullPath.split(">").pop().trim();
          }
        }
      } else {
        displayTitleLoc = state.location.split(">").pop().trim();
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

    // [수정] 무한 스크롤(더보기)이 아닐 때만 목록 초기화
    if (!isLoadMore) {
      chunkPage = 1;
      hasMoreChunks = true;
      productGrid.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:#868e96; font-weight: bold;">데이터를 불러오는 중입니다... 🚚</div>';
    } else {
      isFetchingNextChunk = true;
      productGrid.insertAdjacentHTML(
        "beforeend",
        '<div id="chunkLoading" style="grid-column: 1/-1; text-align: center; padding: 20px; color:#868e96;">다음 데이터를 불러오는 중...</div>',
      );
    }

    const currentFilters = {
      category: state.category,
      keyword: state.keyword,
      tags: state.tags,
      statusOnlyActive: state.statusOnlyActive,
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      sort: state.sort,
      page: chunkPage, // [추가] 백엔드에 100개 단위 청크 요청용 페이지 번호
      limit: 100, // [추가] 청크 사이즈
    };

    const context = await UdongAPI.getUserContext(state.role);
    const isVerifiedBuyer = context.isVerified;

    let boundingBox = null;
    if (context.lat && context.lon && context.location) {
      const upperRegion = window.getUpperRegion
        ? window.getUpperRegion(context.location)
        : context.location;
      boundingBox = getSearchBoundingBox(context.lat, context.lon, upperRegion);
    }

    const userContext = {
      role: state.role,
      location: state.location,
      lat: context.lat,
      lon: context.lon,
      ...(boundingBox || {}),
    };

    try {
      const responseData = await FeedAPI.fetchFeed(
        state.viewMode,
        currentFilters,
        userContext,
      );
      const { list, counts } = responseData;

      if (
        state.keyword &&
        counts &&
        state.viewMode === "products" &&
        counts.products === 0 &&
        counts.requests > 0
      ) {
        state.viewMode = "requests";
        return renderRevised(isDragAction, preventScroll);
      }

      // [추가] 더보기 로딩 표시 제거
      const loadingIndicator = document.getElementById("chunkLoading");
      if (loadingIndicator) loadingIndicator.remove();

      // [추가] 받아온 청크에 더 이상 데이터가 없으면 무한 스크롤 중단
      if (list.length === 0 && isLoadMore) {
        hasMoreChunks = false;
        isFetchingNextChunk = false;
        return;
      }

      if (!isLoadMore) {
        productGrid.innerHTML = "";
      }

      if (list.length === 0 && !isLoadMore) {
        showEmptyState(
          state.keyword
            ? `'${state.keyword}'의 검색 결과가 없습니다.`
            : "조건에 맞는 공구가 없습니다.",
          true,
        );
      } else {
        const htmlChunks = list.map((item) =>
          isRequestMode
            ? createRequestCardHTML(item, isVerifiedBuyer)
            : createProductCardHTML(item, isVerifiedBuyer),
        );

        // [수정] 무한 스크롤 시 기존 목록 아래에 덧붙이기
        if (isLoadMore) {
          productGrid.insertAdjacentHTML("beforeend", htmlChunks.join(""));
        } else {
          productGrid.innerHTML = htmlChunks.join("");
        }
      }

      isFetchingNextChunk = false; // [추가] 데이터 로드 완료 상태 해제
    } catch (e) {
      if (!isLoadMore) {
        productGrid.innerHTML =
          '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color:#e03131;">서버와 통신할 수 없습니다.</div>';
      }
      isFetchingNextChunk = false;
    }

    await updateSideWidget();
  }

  /* ==========================================================================
     [6] 사이드바 위젯 로직 (리팩토링 버전)
     ========================================================================== */
  async function updateSideWidget() {
    const widgetContainer = document.querySelector(
      ".sidebar-right .widget.highlighted",
    );
    if (!widgetContainer) return;

    if (!IS_LOGGED_IN) {
      widgetContainer.innerHTML = `<h3 class="widget-title">📦 배송비 0원 챌린지!</h3><div class="login-promo-box"><div class="promo-icon">🚚</div><p class="promo-title">이웃과 함께 나누면<br>배송비가 0원!</p><p class="promo-desc">지금 바로 로그인하고<br>우리 동네 공구에 참여해보세요.</p><button class="btn-join" onclick="location.href='/pages/login/login.html'">로그인하기</button></div>`;
      updateRequestWidget();
      return;
    }

    try {
      const context = await UdongAPI.getUserContext(state.role);
      if (state.role === "buyer" && !context.isVerified) {
        widgetContainer.innerHTML = `<h3 class="widget-title">나의 참여 현황</h3><div class="login-promo-box"><div class="promo-icon">📍</div><p class="promo-title" style="margin-bottom:8px;">동네 인증이 필요합니다</p><p class="promo-desc">인증을 완료해야 나의 참여 현황과<br>동네 이웃들의 공구를 볼 수 있어요.</p><button class="btn-join" onclick="window.startGpsAuth(-1)">동네 인증하기</button></div>`;
        updateRequestWidget();
        return;
      }

      const summary = await UdongAPI.getUserSummary(state.role);
      if (!summary) throw new Error("요약 정보 없음");

      if (state.role === "admin") {
        widgetContainer.innerHTML = `<h3 class="widget-title">🛑 회원 제재 관리</h3><div class="admin-ban-panel" style="margin-top:10px;"><input type="text" id="adminBanUser" class="admin-input" placeholder="닉네임 입력" style="margin-bottom:5px;"><select id="adminBanReason" class="admin-input" style="margin-bottom:5px;"><option value="" disabled selected>제재 사유 선택</option><option value="abuse">욕설 및 비방</option><option value="scam">거래 사기</option><option value="spam">도배 및 광고</option><option value="noshow">거래 파기/노쇼</option></select><select id="adminBanLevel" class="admin-input" style="margin-bottom:10px;"><option value="" disabled selected>제재 단계 선택</option><option value="warning">1차 경고</option><option value="suspend_7d">7일 정지</option><option value="suspend_30d">30일 정지</option><option value="ban_permanent">영구 정지</option></select><button class="btn-ban" onclick="window.executeSanction()" style="width:100%; background:#e03131; color:white; padding:10px; border-radius:6px; font-weight:bold; border:none; cursor:pointer;">제재 실행</button></div>`;
      } else if (state.role === "seller") {
        widgetContainer.innerHTML = `<h3 class="widget-title">📊 판매자 현황</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;"><div style="display:flex; justify-content:space-between; font-size:14px;"><span>진행중인 입찰</span><span style="font-weight:700; color:#4c6ef5;">${summary.inProgressCount}건</span></div><div style="display:flex; justify-content:space-between; font-size:14px;"><span>이번 달 낙찰</span><span style="font-weight:700;">${summary.successCount}건</span></div><hr style="border:none; border-top:1px solid #eee; margin:5px 0;"><div><p class="savings-label">이번 달 정산 예정금</p><p class="savings-amount" style="font-size:22px;">${summary.settlementAmount.toLocaleString()}원</p></div></div><button class="widget-button" onclick="location.href='/pages/mypage/partner_settlement.html'">자세히 보기</button>`;
      } else {
        widgetContainer.innerHTML = `<h3 class="widget-title">나의 참여 현황</h3><div class="participation-item" id="activeParticipationItem"></div><hr style="border: none; border-top: 1px solid #f1f3f5; margin: 16px 0;" /><div><p class="savings-label">이번 달 아낀 배송비</p><p class="savings-amount">${summary.totalSavings.toLocaleString()}원 💰</p></div><button class="widget-button" id="btnGoMyDelivery">자세히 보기</button>`;

        const partItem = document.getElementById("activeParticipationItem");
        const detailBtn = document.getElementById("btnGoMyDelivery");
        const item = summary.activeItem;

        if (item) {
          const isMatched =
            item.status === "closed" ||
            item.status === "completed" ||
            item.status === "matched" ||
            parseInt(item.participants || 0) >=
              parseInt(item.maxParticipants || 1);

          const countInfo = item.participants
            ? ` (${item.participants}/${item.maxParticipants}명)`
            : "";

          partItem.style.cursor = "pointer";

          // ★ [버그 해결 및 기능 보완] 상세페이지 진입 전 프론트엔드(Edge)에서 거리 검증 및 차단
          partItem.onclick = async () => {
            try {
              const targetDate = parseCustomDate(item.deadline);
              const isExpired =
                isMatched ||
                item.status === "expired" ||
                (targetDate && targetDate - new Date() <= 0);

              if (state.role === "buyer" && !isExpired) {
                const myLocs = await UdongAPI.getUserLocations("buyer");
                const verifiedLocs = myLocs.filter(
                  (l) => l.verified && !l.expired,
                );

                if (verifiedLocs.length > 0) {
                  let currentMatched = false;
                  let alternativeMatchedLoc = null;

                  for (const loc of verifiedLocs) {
                    const upper = window.getUpperRegion
                      ? window.getUpperRegion(loc.name)
                      : loc.name;
                    const isUrban = [
                      "서울",
                      "경기",
                      "부산",
                      "인천",
                      "대구",
                      "대전",
                      "광주",
                    ].some((city) => upper.includes(city));
                    const radiusLimit = isUrban ? 3000 : 5000;

                    const dist = window.udongCalculateDistance(
                      loc.lat,
                      loc.lon,
                      parseFloat(item.lat),
                      parseFloat(item.lon),
                    );

                    if (dist <= radiusLimit) {
                      if (loc.selected) {
                        currentMatched = true;
                        break;
                      }
                      if (!alternativeMatchedLoc) alternativeMatchedLoc = loc;
                    }
                  }

                  // 나의 참여 현황의 경우, 본인이 참여 중인 게시글이므로 차단 알림은 띄우지 않되
                  // 다른 인증 지역 반경에 포함된다면 해당 지역으로 자동 스위칭
                  if (!currentMatched && alternativeMatchedLoc) {
                    myLocs.forEach(
                      (l) =>
                        (l.selected = l.name === alternativeMatchedLoc.name),
                    );
                    await UdongAPI.saveUserLocations("buyer", myLocs);
                    window.dispatchEvent(new Event("locationChange"));
                  }
                }
              }

              // [핵심] 가짜 DB용 로컬 스토리지 저장 로직 완전 삭제 및 파라미터 기반 라우팅 적용
              const typeStr = String(item.id).startsWith("req")
                ? "request"
                : "post";
              location.href = `../post/detail.html?id=${item.id}&type=${typeStr}`;
            } catch (e) {
              console.error("나의 참여 현황 클릭 에러:", e);
            }
          };

          partItem.innerHTML = `
            <div class="participation-icon" style="overflow:hidden; border:1px solid #eee; padding:0;">
              <img src="${item.image || "https://via.placeholder.com/100"}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div class="participation-info">
              <p class="participation-title" style="font-weight:700; font-size:15px; margin-bottom:2px;">${item.title}</p>
              <p class="participation-status" style="font-size:12px; color:#ff6f0f; font-weight:700;">${isMatched ? "매칭 완료" : "매칭 진행중"}${countInfo}</p>
            </div>`;
          detailBtn.disabled = false;
          detailBtn.onclick = () => {
            location.href = "/pages/mypage/buyer_delivery.html";
          };
        } else {
          detailBtn.disabled = true;
        }
      }
      updateRequestWidget();
    } catch (error) {
      console.error("위젯 데이터 로드 실패:", error);
      let titleText = "나의 참여 현황";
      if (state.role === "seller") titleText = "📊 판매자 현황";
      else if (state.role === "admin") titleText = "🛑 회원 제재 관리";
      widgetContainer.innerHTML = `<h3 class="widget-title">${titleText}</h3><div style="padding: 30px 10px; text-align: center; color: #868e96; font-size: 13px;">데이터를 불러오지 못했습니다.<br>잠시 후 새로고침 해주세요.</div>`;
    }
  }

  async function updateRequestWidget() {
    const widget = document.getElementById("requestWidget");
    if (!widget) return;
    const listContainer = widget.querySelector(".request-list");

    try {
      const reqs = await UdongAPI.getSidebarRequests();

      listContainer.innerHTML = "";
      if (reqs.length === 0) {
        listContainer.innerHTML = `<li style="padding:15px; text-align:center; color:#868e96; font-size:13px;">등록된 요청이 없습니다.</li>`;
        return;
      }

      reqs.forEach((req) => {
        let time = getTimeAgo(req.timestamp);
        // [핵심] 로컬 스토리지 찌꺼기 없이 깔끔하게 URL 파라미터만 넘김
        listContainer.insertAdjacentHTML(
          "beforeend",
          `<li class="request-item" onclick="window.location.href='../post/detail.html?id=${req.id}&type=request'"><span class="request-text" style="font-size:13px;">${req.title}</span><span class="request-time">${time}</span></li>`,
        );
      });
    } catch (error) {
      console.error("공구 요청 목록 로드 실패:", error);
      listContainer.innerHTML = `<li style="padding:15px; text-align:center; color:#fa5252; font-size:13px;">목록을 불러오는 중 오류가 발생했습니다.</li>`;
    }
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

    renderRevised(false, true); // 기본 스크롤 동작 방지

    // 배너를 완전히 지나쳐 상단에 딱 붙도록 스크롤
    setTimeout(() => {
      const contentArea = document.querySelector(".main-content");
      if (contentArea) {
        window.scrollTo({
          top: contentArea.offsetTop - 80,
          behavior: "smooth",
        });
      }
    }, 150);
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

  async function updateLocation() {
    // [핵심 수정] 이제 getUserContext가 서버(KV) 동기화를 완벽하게 보장합니다.
    const context = await UdongAPI.getUserContext(state.role);

    state.location = context.location;
    state.lat = context.lat;
    state.lon = context.lon;
    const isVerifiedBuyer = context.isVerified;

    const reqSubmitBtn = document.querySelector(".request-submit-btn");
    if (reqSubmitBtn) {
      const checkLoggedIn =
        localStorage.getItem("udong_is_logged_in") === "true";

      // 🚀 [추가] 로그인하지 않았을 경우 모든 위치 컨텍스트 초기화
      if (!checkLoggedIn) {
        state.location = null;
        state.lat = null;
        state.lon = null;
        if (feedTitle) feedTitle.innerText = "모집 중인 공구";
        renderRevised();
        return;
      }

      if (state.role === "seller" || state.role === "admin") {
        // 1. 판매자와 관리자는 버튼 숨김
        reqSubmitBtn.style.display = "none";
      } else if (!checkLoggedIn) {
        // 2. 비로그인 상태 (회색 처리 + 로그인 유도)
        reqSubmitBtn.style.display = "block";
        reqSubmitBtn.textContent = "로그인 필요";
        reqSubmitBtn.style.backgroundColor = "#adb5bd";
        reqSubmitBtn.style.color = "white";
        reqSubmitBtn.style.cursor = "not-allowed";
        reqSubmitBtn.disabled = false;
        reqSubmitBtn.onclick = (e) => {
          e.preventDefault();
          if (confirm("로그인이 필요한 서비스입니다.\n로그인하시겠습니까?")) {
            location.href = "/pages/login/login.html";
          }
        };
      } else if (!isVerifiedBuyer) {
        // 3. 로그인한 구매자지만 동네 인증이 만료/없음 상태 (서버 검증 완료)
        reqSubmitBtn.style.display = "block";
        reqSubmitBtn.textContent = "동네 인증 필요";
        reqSubmitBtn.style.backgroundColor = "#adb5bd";
        reqSubmitBtn.style.color = "white";
        reqSubmitBtn.style.cursor = "not-allowed";
        reqSubmitBtn.disabled = false;
        reqSubmitBtn.onclick = (e) => {
          e.preventDefault();
          alert("동네 인증이 완료된 사용자만 요청글을 작성할 수 있습니다.");
        };
      } else {
        // 4. 모든 조건을 만족한 상태 (버튼 활성화)
        reqSubmitBtn.style.display = "block";
        reqSubmitBtn.textContent = "나도 요청글 쓰기";
        reqSubmitBtn.style.backgroundColor = "var(--primary)";
        reqSubmitBtn.style.color = "white";
        reqSubmitBtn.style.cursor = "pointer";
        reqSubmitBtn.disabled = false;
        reqSubmitBtn.onclick = (e) => {
          e.preventDefault();
          if (typeof window.openRequestModal === "function")
            window.openRequestModal();
        };
      }
    }

    resetFilters("full");
    renderRevised();
    renderRecentWidget();
  }

  async function saveRecentItem(itemData) {
    if (!IS_LOGGED_IN) return;
    const role = state.role || "buyer";
    await UdongAPI.saveRecentItem(role, itemData);
  }

  async function renderRecentWidget() {
    if (!recentItemsList) return;

    if (!IS_LOGGED_IN) {
      recentItemsList.innerHTML = `<div class="recent-placeholder" style="color:#adb5bd; line-height:1.4;">로그인 후<br>확인할 수 있습니다</div>`;
      if (btnClearRecent) btnClearRecent.disabled = true;
      return;
    }

    const items = await UdongAPI.getRecentItems(state.role);
    recentItemsList.innerHTML = "";

    if (!items || items.length === 0) {
      recentItemsList.innerHTML = `<div class="recent-placeholder">최근 본<br>공구가 없습니다</div>`;
      if (btnClearRecent) btnClearRecent.disabled = true;
    } else {
      if (btnClearRecent) btnClearRecent.disabled = false;
      items.slice(0, 3).forEach((item) => {
        const imgPath = item.image || (item.fullData && item.fullData.image);
        const itemEl = document.createElement("div");
        itemEl.className = "recent-item";
        itemEl.innerHTML = `<img src="${imgPath}" onerror="this.src='https://via.placeholder.com/50?text=No+Img'">`;

        // ★ [버그 해결 및 기능 보완] 상세페이지 진입 전 프론트엔드(Edge)에서 거리 검증 및 차단
        itemEl.onclick = async () => {
          try {
            const fullData = item.fullData || item;

            // 1. 기한 만료(또는 완료) 여부 확인 (만료된 목록은 예외적으로 상세 진입 허용)
            const targetDate = parseCustomDate(fullData.deadline);
            const isExpired =
              fullData.status === "closed" ||
              fullData.status === "expired" ||
              (targetDate && targetDate - new Date() <= 0);

            // 2. 구매자일 경우에만 지역 범위 검사 수행
            if (state.role === "buyer" && !isExpired) {
              const myLocs = await UdongAPI.getUserLocations("buyer");
              const verifiedLocs = myLocs.filter(
                (l) => l.verified && !l.expired,
              );

              if (verifiedLocs.length > 0) {
                let currentMatched = false;
                let alternativeMatchedLoc = null;

                // 인증된 모든 지역을 대상으로 거리 검사 (도심 3km, 지방 5km)
                for (const loc of verifiedLocs) {
                  const upper = window.getUpperRegion
                    ? window.getUpperRegion(loc.name)
                    : loc.name;
                  const isUrban = [
                    "서울",
                    "경기",
                    "부산",
                    "인천",
                    "대구",
                    "대전",
                    "광주",
                  ].some((city) => upper.includes(city));
                  const radiusLimit = isUrban ? 3000 : 5000;

                  const dist = window.udongCalculateDistance(
                    loc.lat,
                    loc.lon,
                    parseFloat(fullData.lat),
                    parseFloat(fullData.lon),
                  );

                  if (dist <= radiusLimit) {
                    if (loc.selected) {
                      currentMatched = true;
                      break;
                    }
                    if (!alternativeMatchedLoc) alternativeMatchedLoc = loc;
                  }
                }

                if (!currentMatched) {
                  if (alternativeMatchedLoc) {
                    // 현재 지역 밖이지만, 다른 인증 지역 반경 안임 -> 해당 지역으로 자동 스위칭
                    myLocs.forEach(
                      (l) =>
                        (l.selected = l.name === alternativeMatchedLoc.name),
                    );
                    await UdongAPI.saveUserLocations("buyer", myLocs);
                    window.dispatchEvent(new Event("locationChange"));
                  } else {
                    // 어떤 인증 지역 범위에도 속하지 않음 -> 차단 안내 후 함수 종료
                    alert(
                      "인증된 지역 중 어느 지역의 범위에도 해당되지 않아 참여할 수 없는 공구입니다.",
                    );
                    return;
                  }
                }
              }
            }

            // [핵심] 가짜 DB용 로컬 스토리지 저장 로직 완전 삭제 및 파라미터 기반 라우팅 적용
            const typeStr = String(fullData.id).startsWith("req")
              ? "request"
              : "post";
            window.location.href = `../post/detail.html?id=${fullData.id}&type=${typeStr}`;
          } catch (e) {
            console.error("최근 본 공구 클릭 라우팅 에러:", e);
          }
        };
        recentItemsList.appendChild(itemEl);
      });
    }
  }
  if (btnClearRecent) {
    btnClearRecent.addEventListener("click", async () => {
      await UdongAPI.clearRecentItems(state.role);
      renderRecentWidget();
    });
  }

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

    const render = async () => {
      const history = await UdongAPI.getSearchHistory();
      list.innerHTML = "";
      if (history.length === 0) {
        list.innerHTML = `<li class="no-history">최근 검색어가 없습니다.</li>`;
        return;
      }
      history.forEach((k) => {
        const li = document.createElement("li");
        li.className = "history-item";
        li.innerHTML = `<span class="history-text">${k}</span><button type="button" class="btn-delete-history">✕</button>`;
        li.querySelector(".history-text").addEventListener("click", () => {
          input.value = k;
          performSearch();
        });
        li.querySelector(".btn-delete-history").addEventListener(
          "click",
          async (e) => {
            e.stopPropagation();
            await UdongAPI.deleteSearchHistory(k);
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
      ?.addEventListener("click", async () => {
        await UdongAPI.deleteSearchHistory();
        render();
      });
  }

  async function saveSearchHistory(keyword) {
    await UdongAPI.saveSearchHistory(keyword);
  }

  // 전역 검색 이벤트 리스너 (common.js에서 보낸 신호 수신)
  window.addEventListener("executeSearchEvent", () => {
    const input = document.getElementById("searchInput");
    if (input) {
      state.keyword = input.value.trim().toLowerCase();
      renderRevised(false, true);
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#searchClearBtn")) {
      e.preventDefault();
      resetFilters("full");
      renderRevised();
    }
    // [수정] .request-submit-btn 관련 전역 클릭 이벤트는 updateLocation 내부의 동적 onclick 속성으로 안전하게 이관되었으므로 삭제함
  });

  // =========================================================================
  // [수정 후] 이벤트 콜백에 async 추가 및 로컬스토리지 직접 조작 제거
  // =========================================================================
  productGrid.addEventListener("click", async (e) => {
    const card = e.target.closest("article");
    if (!card) return;

    if (!IS_LOGGED_IN) {
      if (e.target.closest(".btn-zzim, .btn-bid, .btn-accept-bid") || card) {
        e.preventDefault();
        e.stopPropagation();
        if (confirm("로그인이 필요한 서비스입니다.\n로그인하시겠습니까?"))
          location.href = "/pages/login/login.html";
        return;
      }
    }

    if (
      e.target.classList.contains("btn-delete") ||
      e.target.classList.contains("btn-accept-bid") ||
      e.target.classList.contains("btn-bid")
    )
      return;

    if (card.classList.contains("admin-deleted")) return;

    const zzimBtn = e.target.closest(".btn-zzim");
    const dId = card.dataset.id;
    const isRequest = card.dataset.type === "request";
    const type = isRequest ? "request" : "post";
    const itemData = await UdongAPI.getPostDetail(type, dId);
    if (!itemData) return;

    // ★ 찜하기 로직 API 연동 형태로 수정된 부분
    if (zzimBtn && !isRequest) {
      e.preventDefault();
      e.stopPropagation();

      const result = await UdongAPI.toggleWishlist(itemData);

      if (result) {
        if (result.isAdded) {
          zzimBtn.classList.add("active");
        } else {
          zzimBtn.classList.remove("active");
        }
      }
      return;
    }

    if (isRequest) {
      // [핵심] 가짜 DB용 로컬 스토리지 저장 로직 완전 삭제 및 파라미터 기반 라우팅 적용
      window.location.href = `../post/detail.html?id=${itemData.id}&type=request`;
    } else {
      await saveRecentItem({
        id: itemData.id,
        title: itemData.title,
        image: itemData.image,
        fullData: itemData,
      });

      // [핵심] 가짜 DB용 로컬 스토리지 저장 로직 완전 삭제 및 파라미터 기반 라우팅 적용
      window.location.href = `../post/detail.html?id=${itemData.id}&type=post`;
    }
  });

  window.addEventListener("addrTypeChange", () => renderRevised(false, true));
  window.addEventListener("locationChange", () => {
    updateLocation();
  });

  // ★ 버그 해결: 슬라이더 이벤트가 중복 등록되지 않도록 막는 안전장치 변수
  let isSliderInitialized = false;

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
            // 마우스를 뗐을 때 단 한 번만 서버에 데이터를 요청
            renderRevised(true);
          };
        document.addEventListener("mousemove", mv);
        document.addEventListener("mouseup", up);
      });
    }

    // ★ 버그 해결: 이벤트 리스너는 최초 1회만 등록하고, 이후 호출 시에는 updateUI()로 바의 위치만 초기화함
    if (!isSliderInitialized) {
      if (handleMin) addList(handleMin, true);
      if (handleMax) addList(handleMax, false);
      isSliderInitialized = true;
    }

    updateUI();
  }

  /* ==========================================================================
     [9] 초기 실행 (Bootstrap) 및 전역 이벤트 연동
     ========================================================================== */
  const boot = async () => {
    try {
      initSlider();
      await updateLocation();
      initSearchHistory();

      // ★ 7번 요구사항: 뒤로가기(Bfcache) 진입 시 검색어 잔재 강제 청소
      window.addEventListener("pageshow", (e) => {
        if (
          e.persisted ||
          performance.getEntriesByType("navigation")[0].type === "back_forward"
        ) {
          if (!localStorage.getItem("udong_pending_search")) {
            resetFilters("full");
            renderRevised();
          }
        }
      });

      // ★ 2번 & 3번 요구사항: 외부 페이지에서 검색어 넘어왔을 때 텍스트 유지 및 배너 패스 스크롤
      const pendingSearch = localStorage.getItem("udong_pending_search");
      if (pendingSearch) {
        localStorage.removeItem("udong_pending_search");

        setTimeout(() => {
          state.keyword = pendingSearch;
          const input = document.getElementById("searchInput");
          if (input) {
            input.value = pendingSearch;
            const clearBtn = document.getElementById("searchClearBtn");
            if (clearBtn) clearBtn.style.display = "block";
          }
          renderRevised(false, true);
          // 배너 아래로 부드럽게 스크롤
          const contentArea = document.querySelector(".main-content");
          if (contentArea) contentArea.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (error) {
      console.error("앱 초기화 중 치명적 에러 발생:", error);
    }
  };

  // 메인에서 직접 검색 실행 시에도 스크롤 연동
  window.addEventListener("executeSearchEvent", () => {
    const input = document.getElementById("searchInput");
    if (input) {
      state.keyword = input.value.trim().toLowerCase();
      renderRevised(false, true);
      const contentArea = document.querySelector(".main-content");
      if (contentArea) contentArea.scrollIntoView({ behavior: "smooth" });
    }
  });

  // ★ 질문하신 부분 (절대 삭제 금지, 원상 복구) ★
  if (typeof window.loadRoadData === "function") {
    window.loadRoadData(() => boot());
  } else {
    boot();
  }
}); // DOMContentLoaded 끝
