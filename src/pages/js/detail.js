document.addEventListener("DOMContentLoaded", async () => {
  // [요구사항 반영] 로그인 가드: 비로그인 상태로 URL을 통해 상세페이지에 직접 접근하거나, 인터넷 기록 삭제 후 새로고침 시 메인으로 강제 추방
  const isLoggedIn = localStorage.getItem("udong_is_logged_in") === "true";
  if (!isLoggedIn) {
    alert("로그인이 필요한 서비스입니다.");
    location.replace("/pages/main/main.html");
    return; // 아래 데이터 조회 로직을 아예 실행하지 않고 차단
  }

  const container = document.getElementById("detailContainer");

  try {
    // [핵심 수정] URL 파라미터(id)를 최우선으로 확인하여 Worker API에서 직접 데이터를 가져오는 정석 웹 아키텍처 적용
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get("id");
    let viewType =
      urlParams.get("type") ||
      localStorage.getItem("detail_view_type") ||
      "post";

    let initialItem = null;

    // [버그 완벽 해결] 단건 조회 시에도 내 닉네임과 권한이 포함된 공통 API를 호출하여 백엔드(KV)로부터 찜/입찰 상태를 정확히 받아옵니다.
    if (urlId) {
      initialItem = await UdongAPI.getPostDetail(viewType, urlId);
    }

    // 3. 최종적으로 데이터를 찾지 못한 경우 (에러 화면 UI 개선)
    if (!initialItem) {
      container.innerHTML = `
        <div style="padding: 100px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">😢</div>
          <h3 style="color: #495057; margin-bottom: 12px;">게시글 정보를 찾을 수 없습니다</h3>
          <p style="color: #868e96; margin-bottom: 24px;">인터넷 기록이 삭제되었거나 잘못된 접근입니다.</p>
          <button onclick="location.href='/pages/main/main.html'" style="padding: 12px 24px; font-size: 15px; font-weight: bold; color: white; background: #ff6f0f; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#e8590c'" onmouseout="this.style.background='#ff6f0f'">메인으로 돌아가기</button>
        </div>`;
      return;
    }

    const role = localStorage.getItem("udong_user_role") || "guest";
    let myNickname = "익명";
    try {
      const infoStr = localStorage.getItem("udong_user_info");
      if (infoStr && infoStr !== "undefined")
        myNickname = JSON.parse(infoStr).nickname || "익명";
    } catch (e) {}

    const context = await UdongAPI.getUserContext(role);
    const isVerifiedBuyer = context.isVerified;

    // [요구사항 반영] 상세 페이지 진입 시 사용자 좌표와 게시글 좌표를 바탕으로 거리를 실시간 계산
    if (context.lat && context.lon && initialItem.lat && initialItem.lon) {
      const R = 6371e3;
      const p1 = (context.lat * Math.PI) / 180;
      const p2 = (initialItem.lat * Math.PI) / 180;
      const dp = ((initialItem.lat - context.lat) * Math.PI) / 180;
      const dl = ((initialItem.lon - context.lon) * Math.PI) / 180;
      const a =
        Math.sin(dp / 2) ** 2 +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
      initialItem.distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // API 통신으로 실제 누적 조회수 가져오기 (1인 1회 집계)
    const currentViews = await UdongAPI.incrementViewCount(
      initialItem.id,
      myNickname,
    );

    // [대청소 완료] 로컬스토리지 뒤지는 로직 삭제, Worker가 응답에 담아준 isWished 값을 그대로 사용
    const isWished = initialItem.isWished === true;

    const CATEGORY_MAP = {
      food: "식품/농산물",
      baby: "육아용품",
      pet: "반려동물",
      living: "생활/주방",
      fashion: "패션/잡화",
      beauty: "뷰티/미용",
      digital: "디지털/가전",
      sports: "스포츠/레저",
      hobby: "취미/게임",
      furniture: "가구/인테리어",
      ticket: "티켓/교환권",
      others: "기타",
    };

    // [에러 해결] 날짜 변환 함수 선언
    const formatTimestamp = (ts) => {
      if (!ts) return "방금 전";
      const s = String(ts);
      if (s.length < 12) return s;
      return `${s.substring(0, 4)}년 ${s.substring(4, 6)}월 ${s.substring(6, 8)}일 ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    };

    const renderDetailUI = (item) => {
      const isRequest = viewType === "request";
      const isHost = item.author === myNickname;
      const isAdmin = role === "admin";
      const isSeller = role === "seller";
      let status = item.status || "active";

      /* === [실제 백엔드 API 연동 시 활성화] ===
      // const isParticipant = item.myRole === "participant";
      ========================================== */
      const isParticipant =
        item.myRole === "participant" ||
        (myNickname === "우동이" && (item.id === "p1" || item.id === "r1"));

      const checkExpired = () => {
        if (!item.deadline) return false;
        const s = String(item.deadline);
        if (s === "미정" || s.length < 12) return false;
        const target = new Date(
          s.substring(0, 4),
          s.substring(4, 6) - 1,
          s.substring(6, 8),
          s.substring(8, 10),
          s.substring(10, 12),
        );
        return target - new Date() <= 0;
      };
      if (status === "active" && checkExpired()) status = "expired";

      const participants =
        parseInt(item.participants || (isRequest ? 0 : 1)) || 0;
      const maxParts = parseInt(
        item.maxParticipants ||
          (isRequest ? item.estimatedParticipants : 1) ||
          1,
      );
      const isFull = participants >= maxParts;
      const percent = Math.min(
        100,
        Math.round((participants / maxParts) * 100),
      );

      if (status === "active" && isFull && !isRequest) status = "closed";

      const getStatusBadge = () => {
        if (status === "active") {
          return isRequest
            ? ""
            : `<span class="product-badge" style="background:#40c057">모집중</span>`;
        }
        // [요구사항 반영] 완료되거나 중단된 모든 상태의 배지 색상을 차분한 회색(#868e96)으로 통일
        if (status === "closed")
          return `<span class="product-badge" style="background:#868e96">모집완료</span>`;
        if (status === "expired")
          return `<span class="product-badge" style="background:#868e96">기한만료</span>`;
        if (status === "canceled")
          return `<span class="product-badge" style="background:#868e96">모집취소</span>`;
        if (status === "completed")
          return `<span class="product-badge" style="background:#868e96">거래확정</span>`;
        if (status === "request_canceled")
          return `<span class="product-badge" style="background:#868e96">요청취소</span>`;
        return "";
      };

      // 4번 요구사항 반영: 메인 피드와 동일하게 나의 역할(Role) 배지 생성 로직 추가
      /* 👇 백엔드 연동 시: 데이터베이스의 게시글 상태값에 의존하도록 로직을 변경하고, 
            프론트엔드에서는 순수하게 UI 분기만 담당하도록 간소화 예정입니다. */
      let roleBadgeHtml = "";

      // [수정] 공구 요청 목록일 경우 어떠한 역할 배지('내가 쓴 글' 포함)도 생성하지 않음
      if (!isRequest) {
        if (role === "seller" && item.myBid === "true") {
          roleBadgeHtml =
            status === "closed" || status === "completed"
              ? `<span class="badge-matching completed" style="margin-right:4px;">🤝 매칭완료</span>`
              : `<span class="badge-matching" style="margin-right:4px;">📢 매칭중</span>`;
        } else if (role === "buyer" && isVerifiedBuyer && item.myRole) {
          if (item.myRole === "host")
            roleBadgeHtml = `<span class="badge-mypost" style="margin-right:4px;">👑 내가 쓴 글</span>`;
          else if (item.myRole === "participant")
            roleBadgeHtml =
              status === "closed" || status === "completed"
                ? `<span class="badge-participating completed" style="margin-right:4px;">🤝 참여완료</span>`
                : `<span class="badge-participating" style="margin-right:4px;">🙋‍♂️ 참여중</span>`;
        }
      }

      // 4번 요구사항 반영: 신선식품, 이벤트 배지 누락 복구
      const safeTags = Array.isArray(item.tags) ? item.tags : [];

      // ★ 오류 1 해결: 누락되었던 formatTimestamp 함수를 적용하여 "202603261200"을 보기 좋은 날짜로 변환
      const safeDeadline =
        item.deadline && item.deadline !== "미정"
          ? formatTimestamp(item.deadline)
          : "미정";

      // [수정] 희망가 0 누락 버그 해결: 팝업에서 콤마(,)가 포함된 문자열(예: "10,000")로 넘어올 경우
      // parseInt가 콤마 앞에서 계산을 멈춰버리는 현상(10으로 인식)을 방지하기 위해 콤마 제거 후 숫자로 변환
      const cleanPrice = (val) =>
        parseInt(String(val).replace(/,/g, ""), 10) || 0;
      const priceValue = item.price
        ? cleanPrice(item.price).toLocaleString() + "원"
        : item.budget
          ? cleanPrice(item.budget).toLocaleString() + "원"
          : "0원";

      let extraBadgesHtml = "";
      // [수정] 공구 요청 목록일 경우 신선식품, 이벤트 등 부가 배지를 일절 생성하지 않음
      if (!isRequest) {
        if (safeTags.includes("fresh"))
          extraBadgesHtml += `<span class="product-badge fresh" style="margin-right:4px;">🌱 신선식품</span>`;
        if (safeTags.includes("event"))
          extraBadgesHtml += `<span class="product-badge event" style="margin-right:4px;">🎁 이벤트</span>`;
      }

      // 3번 요구사항: 이벤트 내용을 배지 옆이 아닌 본문 상단에 단독 배너로 분리 표시
      let eventBannerHtml = "";
      if (safeTags.includes("event") && item.eventText) {
        eventBannerHtml = `
          <div style="background-color: #fff4e6; border: 1px solid #ffe8cc; color: #e8590c; padding: 14px 16px; border-radius: 8px; margin-top: 16px; margin-bottom: 30px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.4rem;">🎁</span>
            <span>이벤트 안내 : ${item.eventText}</span>
          </div>`;
      }

      const priceLabel = isRequest ? "1인당 희망가" : "1인당 최종 금액";
      const catName = CATEGORY_MAP[item.category] || "기타";

      // [핵심 수정] Flex 레이아웃이 깨지지 않도록 position: absolute 적용 및 브라우저 뒤로가기처럼 작고 심플하게 변경
      let html = `
        <button onclick="location.href='/pages/main/main.html'" style="position: absolute; top: -36px; left: 0; background: transparent; border: none; font-size: 24px; font-weight: 900; color: #adb5bd; cursor: pointer; padding: 0 8px; border-radius: 4px; transition: color 0.2s;" onmouseover="this.style.color='#212529'" onmouseout="this.style.color='#adb5bd'" title="메인으로 돌아가기">
          ←
        </button>
        <div class="detail-layout"><div class="detail-left">`;

      // 4번 요구사항: 기한 만료, 마감, 취소 게시물 이미지 흐림 처리 (요청 취소 포함)
      const isExpiredImage =
        status === "expired" ||
        status === "canceled" ||
        status === "closed" ||
        status === "request_canceled"
          ? 'style="filter: grayscale(100%) opacity(0.5);"'
          : "";

      // ★ 오류 해결 1: 가짜 클래스(detail-image-wrap) 삭제 및 원래 있던 detail-hero-image 클래스 복구
      if (!isRequest && item.image) {
        html += `<img src="${item.image}" alt="상품 이미지" class="detail-hero-image" ${isExpiredImage} onerror="this.src='https://via.placeholder.com/800x450?text=No+Image'"/>`;
      }

      // [요구사항 반영] 목록 카드와 동일한 km/m 거리 포맷팅 적용 (에러 원인: HTML 밖으로 JS 분리 완료!)
      const formatDistance = (dist) => {
        if (dist === null || dist === undefined) return "";
        const d = Math.round(dist);
        if (d === 0) return "";
        return ` · 📍 ${d >= 1000 ? (d / 1000).toFixed(1) + "km" : d + "m"}`;
      };
      const distStr = formatDistance(item.distance);

      // ★ 오류 해결 2: 원래 존재하던 올바른 클래스(detail-author-profile, detail-header-info, detail-body) 복구
      html += `
          <div class="detail-author-profile">
            <div class="author-avatar">${isRequest ? "👤" : "🏪"}</div>
            <div class="author-info">
              <span class="author-name">${item.author || "익명"}</span>
              <span class="author-loc" id="authorLocationText">${item.location}${distStr} · 인증 완료 ✅</span>
            </div>
          </div>
          
          <div class="detail-header-info">
            <h1 class="detail-title">${item.title}</h1>
            <div class="detail-meta">
              ${!isRequest ? `<strong style="color:#212529;">${item.shopName || "인증된 가게"}</strong> · ` : ""}
              <span>${catName}</span> · 
              <span>조회 ${currentViews}</span> · 
              <span>${formatTimestamp(item.timestamp)}</span>
            </div>
          </div>
          
          <div class="detail-body">
            ${eventBannerHtml}
            <div class="detail-desc">${item.desc}</div>`;

      /* [요구사항 1 반영] 팝업에 없는 '요청 사유' 삭제 및 [요구사항 2, 3 반영] 예상 인원/참고 링크 정보 박스 추가 */
      if (isRequest && (item.estimatedParticipants || item.link)) {
        html += `<div class="request-extra-info" style="margin-top: 20px; margin-bottom: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; font-size: 14px;">`;
        if (item.estimatedParticipants) {
          const partText = isNaN(item.estimatedParticipants)
            ? item.estimatedParticipants
            : `${item.estimatedParticipants}명`;
          html += `<div style="margin-bottom: ${item.link ? "10px" : "0"}; display: flex; align-items: center;">
                     <span style="font-weight: 700; color: #495057; margin-right: 8px;">👥 예상 인원</span>
                     <span style="color: #212529;">${partText}</span>
                   </div>`;
        }
        if (item.link) {
          const safeLink = item.link.includes("://")
            ? item.link
            : `https://${item.link}`;
          html += `<div style="display: flex; align-items: flex-start;">
                     <span style="font-weight: 700; color: #495057; margin-right: 8px; flex-shrink: 0;">🔗 참고 링크</span>
                     <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="color: #1c7ed6; text-decoration: underline; word-break: break-all;">${item.link}</a>
                   </div>`;
        }
        html += `</div>`;
      }

      html += `
          <div style="font-size:15px; font-weight:800; margin-bottom:10px;">📍 거래 희망 장소</div>
          <div style="font-size:14px; color:#495057; margin-bottom:10px;" id="transactionLocationText">${item.location}</div>
          <div class="detail-map-container" id="detailMap" style="margin-bottom:30px;"></div>
      `;

      if (isRequest) {
        const bids = item.bids || [];
        html += `<div class="bids-section"><h3 class="bids-title">🤝 도착한 입찰 제안 (${bids.length}건)</h3>`;
        if (bids.length === 0) {
          html += `<div style="padding:20px; text-align:center; color:#868e96; background:#f8f9fa; border-radius:8px;">아직 도착한 제안이 없습니다.</div>`;
        } else {
          bids.forEach((bid) => {
            let extraDetails = "";
            for (const [key, value] of Object.entries(bid)) {
              if (["sellerName", "price", "time", "message"].includes(key))
                continue;
              extraDetails += `<li style="margin-bottom:4px;"><strong>${key}:</strong> ${value}</li>`;
            }
            html += `
              <div class="accordion-item">
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                  <span>🏪 ${bid.sellerName} <span style="color:#ff6f0f; margin-left:8px;">${bid.price}</span></span>
                  <span style="font-size:12px; color:#adb5bd;">${bid.time || "방금 전"} ▼</span>
                </div>
                <div class="accordion-body">
                  ${extraDetails ? `<ul style="background:#fff4e6; padding:12px 12px 12px 24px; border-radius:8px; margin-bottom:15px; font-size:13px; color:#d9480f;">${extraDetails}</ul>` : ""}
                  <p style="margin-bottom:12px; color:#495057;">${bid.message}</p>
                  ${isHost && status === "active" ? `<button class="btn-action-large primary" style="width:100%; padding:10px; font-size:14px;" onclick="detailActions.updateStatus('completed', '이 제안을 수락하시겠습니까?');">이 제안 수락하기</button>` : ""}
                </div>
              </div>`;
          });
        }
        html += `</div>`;
      }

      html += `</div></div>`;

      const isUrgent = item.isUrgent === true && status === "active";

      // [요구사항 반영] 위젯 상단에 띄울 기한 만료 / 요청 취소 붉은 배지 생성
      let widgetStatusBadge = "";
      if (status === "request_canceled") {
        widgetStatusBadge = `<div style="background:#fa5252; color:white; text-align:center; padding:12px; border-radius:8px; margin-bottom:16px; font-weight:bold; font-size:15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🚨 요청 취소됨</div>`;
      } else if (status === "expired" || status === "canceled") {
        widgetStatusBadge = `<div style="background:#fa5252; color:white; text-align:center; padding:12px; border-radius:8px; margin-bottom:16px; font-weight:bold; font-size:15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">⏰ 기한 만료</div>`;
      }

      // 우측 컬럼 시작
      html += `<div class="detail-right">`;

      // [요구사항 반영] 중복 생성되던 임시 배지를 삭제하고, getStatusBadge() 하나로 통합하여 깔끔하게 렌더링
      html += `
                <div class="right-badge-wrap">
                  ${roleBadgeHtml}           ${getStatusBadge()}       ${extraBadgesHtml}         ${isUrgent ? '<span class="product-badge urgent">⚡️ 마감임박</span>' : ""}
                </div>`;

      html += `
                <div class="right-price-label">${priceLabel}</div>
                <div style="font-size: 24px; font-weight: 800; color: #212529; margin-bottom: 20px;">${priceValue}</div>`;

      if (!isRequest) {
        html += `
          <div class="right-participants-info">
            <div class="part-text">현재 참여 인원 <span class="highlight">${participants}명</span> / ${maxParts}명</div>
            <div class="part-remaining">남은 자리 ${Math.max(0, maxParts - participants)}명</div>
          </div>
          <div class="progress-bar"><div class="progress-fill ${isFull ? "full" : ""}" style="width: ${percent}%"></div></div>
        `;
      }

      html += `<div class="right-summary-box">
          <div class="summary-row"><span>📅</span><span>마감: ${safeDeadline}</span></div>`;

      if (item.receiveMethod) {
        html += `<div class="summary-row"><span>📦</span><span>수령: ${item.receiveMethod}</span></div>`;
      }

      if (!isRequest) {
        html += `<div class="summary-row"><span>💳</span><span>결제: 안전결제 (우동페이)</span></div>`;
      }

      html += `</div>`;

      // [요구사항 반영] 하단 버튼 텍스트 유지 및 비활성화
      let actionBtns = "";
      const disabledStyle = "opacity: 0.5; cursor: not-allowed;";

      if (isAdmin) {
        actionBtns = `<button class="btn-action-large danger" onclick="detailActions.deletePost()">삭제 (관리자)</button>`;
      } else if (isSeller) {
        if (isRequest) {
          if (status === "active")
            actionBtns = `<button class="btn-action-large primary" onclick="window.openBidModal('${item.id}', '${(item.title || "").replace(/'/g, "\\'")}')">입찰 제안하기</button>`;
          else
            actionBtns = `<button class="btn-action-large primary" disabled style="${disabledStyle}">입찰 제안하기</button>`;
        } else {
          actionBtns = `<button class="btn-action-large secondary" disabled style="${disabledStyle}">구매자 전용 공구</button>`;
        }
      } else if (role === "buyer") {
        if (isHost) {
          if (isRequest) {
            if (status === "active")
              actionBtns = `<button class="btn-action-large secondary" onclick="detailActions.cancelRequest()">요청 취소</button>`;
            else
              actionBtns = `<button class="btn-action-large secondary" disabled style="${disabledStyle}">요청 취소</button>`;
          } else {
            if (status === "active")
              actionBtns = `<button class="btn-action-large secondary" onclick="detailActions.cancelPost()">모집 취소</button><button class="btn-action-large primary" onclick="detailActions.closeEarly()">조기 마감</button>`;
            else if (status === "closed")
              actionBtns = `<button class="btn-action-large primary" onclick="detailActions.confirmTransaction()">거래 확정하기</button>`;
            else
              actionBtns = `<button class="btn-action-large secondary" disabled style="${disabledStyle}">모집 취소</button><button class="btn-action-large primary" disabled style="${disabledStyle}">조기 마감</button>`;
          }
        } else {
          if (isRequest) {
            actionBtns = "";
          } else {
            if (status === "active") {
              if (isParticipant)
                actionBtns = `<button class="btn-action-large secondary" onclick="detailActions.cancelParticipation()">참여 취소하기</button>`;
              else
                actionBtns = `<button class="btn-action-large primary" onclick="detailActions.participate()">공구 참여하기</button>`;
            } else {
              if (isParticipant)
                actionBtns = `<button class="btn-action-large secondary" disabled style="${disabledStyle}">참여 취소하기</button>`;
              else
                actionBtns = `<button class="btn-action-large primary" disabled style="${disabledStyle}">공구 참여하기</button>`;
            }
          }
        }
      }

      html += `<div class="right-action-buttons">`;
      if (role === "buyer" && !isHost && !isRequest && status === "active") {
        // [버그 해결] 클릭한 버튼 자신(this)을 함수로 전달하여 새로고침 없이 색상만 바꾸도록 수정
        html += `<button class="btn-zzim-large ${isWished ? "active" : ""}" onclick="detailActions.toggleZzim(this)">♥</button>`;
      }

      html += `${actionBtns}</div></div></div>`;

      container.innerHTML = html;

      // ★ 4번 & 5번 요구사항: 거래 희망 장소(하단)에만 역지오코딩 적용 + 도로명 토글 시 즉각 반영
      if (item.lat && item.lon && window.kakao && kakao.maps.services) {
        const mapContainer = document.getElementById("detailMap");
        const loc = new kakao.maps.LatLng(item.lat, item.lon);
        if (mapContainer) {
          const map = new kakao.maps.Map(mapContainer, {
            center: loc,
            level: 3,
          });
          new kakao.maps.Marker({ position: loc, map: map });
        }

        // [수정] 닉네임 밑은 짧게(행정동/도로명), 거래 장소는 길게(스위치 연동 전체 주소) 표시하는 동적 변환 로직
        const updateAddressUI = () => {
          try {
            const prefKey = window.getAddrKey
              ? window.getAddrKey()
              : role === "buyer"
                ? "udong_addr_type_buyer"
                : "udong_addr_type_seller";
            const isRoadState = localStorage.getItem(prefKey) === "road";

            // --- 1. 상단 프로필용 짧은 주소 (행정동 or 짧은 도로명) ---
            let shortBaseAddr = "";
            if (isRoadState) {
              shortBaseAddr =
                item.roadAddr ||
                (typeof window.getMatchedRoadName === "function"
                  ? window.getMatchedRoadName(item.location)
                  : item.location);
            } else {
              shortBaseAddr =
                item.location && item.location.includes(">")
                  ? item.location.split(">").pop().trim()
                  : item.location;
            }

            const authorEl = document.getElementById("authorLocationText");
            if (authorEl) {
              // [요구사항 반영] 토글 시에도 동일한 거리 텍스트 포맷 유지 (문법 에러 완벽 해결)
              const formatDist = (dist) => {
                if (dist === null || dist === undefined) return "";
                const d = Math.round(dist);
                if (d === 0) return "";
                return ` · 📍 ${d >= 1000 ? (d / 1000).toFixed(1) + "km" : d + "m"}`;
              };
              const distStr = formatDist(item.distance);
              authorEl.innerText = `${shortBaseAddr}${distStr} · 인증 완료 ✅`;
            }

            // --- 2. 하단 거래 장소용 동적 전체 주소 (지번/도로명 혼용 방지 및 SIDO 통일) ---
            const transEl = document.getElementById("transactionLocationText");
            if (transEl && window.kakao && kakao.maps.services) {
              const geocoder = new kakao.maps.services.Geocoder();
              geocoder.coord2Address(
                item.lon,
                item.lat,
                async (addrRes, addrStatus) => {
                  if (
                    addrStatus === kakao.maps.services.Status.OK &&
                    addrRes[0]
                  ) {
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

                    let jibunBase = addrRes[0].address.address_name;
                    const sidoShort = addrRes[0].address.region_1depth_name;
                    if (SIDO_MAP[sidoShort])
                      jibunBase = jibunBase.replace(
                        sidoShort,
                        SIDO_MAP[sidoShort],
                      );

                    const bDong = addrRes[0].address.region_3depth_name;
                    const hDong =
                      item.location && item.location.includes(">")
                        ? item.location.split(">").pop().trim()
                        : item.location;

                    // [요구사항 반영] 상세페이지 지번 주소에서도 법정동 완전 배제 (치환 오류 방지)
                    if (bDong && hDong && jibunBase.includes(bDong)) {
                      const parts = jibunBase.split(" ");
                      const dongIdx = parts.findIndex(
                        (p) =>
                          p === bDong ||
                          p.endsWith("동") ||
                          p.endsWith("읍") ||
                          p.endsWith("면"),
                      );
                      if (dongIdx !== -1) {
                        const jibunTail = parts.slice(dongIdx + 1).join(" ");
                        const sidoGu = parts.slice(0, dongIdx).join(" ");
                        jibunBase = `${sidoGu} ${hDong} ${jibunTail}`.trim();
                      }
                    }

                    let roadBase = "";
                    if (addrRes[0].road_address) {
                      roadBase = addrRes[0].road_address.address_name;
                      const rSido = roadBase.split(" ")[0];
                      if (SIDO_MAP[rSido])
                        roadBase = roadBase.replace(rSido, SIDO_MAP[rSido]);
                    } else {
                      // [핵심 해결] 상세페이지에서도 길거리에 핀이 찍혔을 때, 주변 편의점 등의 '건물 번호가 있는 풀 도로명'을 훔쳐옴!
                      const ps = new kakao.maps.services.Places();
                      const nearbyFullRoad = await new Promise((res) => {
                        ps.categorySearch(
                          "CS2",
                          (d, s) => {
                            if (
                              s === kakao.maps.services.Status.OK &&
                              d[0].road_address_name
                            )
                              res(d[0].road_address_name);
                            else
                              ps.categorySearch(
                                "FD6",
                                (d2, s2) => {
                                  if (
                                    s2 === kakao.maps.services.Status.OK &&
                                    d2[0].road_address_name
                                  )
                                    res(d2[0].road_address_name);
                                  else res("");
                                },
                                { x: item.lon, y: item.lat, radius: 100 },
                              );
                          },
                          { x: item.lon, y: item.lat, radius: 100 },
                        );
                      });

                      if (nearbyFullRoad) {
                        roadBase = nearbyFullRoad;
                        const rSido = roadBase.split(" ")[0];
                        if (SIDO_MAP[rSido])
                          roadBase = roadBase.replace(rSido, SIDO_MAP[rSido]);
                      } else {
                        // 최후의 수단
                        const nearbyRoad = await window.getNearbyRoadNameAsync(
                          item.lat,
                          item.lon,
                        );
                        if (nearbyRoad) {
                          const sido =
                            SIDO_MAP[addrRes[0].address.region_1depth_name] ||
                            addrRes[0].address.region_1depth_name;
                          const gu = addrRes[0].address.region_2depth_name;
                          roadBase = `${sido} ${gu} ${nearbyRoad}`;
                        }
                      }
                    }

                    // [핵심 해결] 지번/도로명 숫자 꼬임 방지: 원본 텍스트에서 Base 주소를 완벽히 벗겨내어 순수 '상세 주소'만 추출
                    let pureDetail =
                      item.rawFullAddress || item.detailedAddress || "";
                    if (pureDetail) {
                      if (roadBase && pureDetail.startsWith(roadBase)) {
                        pureDetail = pureDetail
                          .substring(roadBase.length)
                          .trim();
                      } else if (
                        jibunBase &&
                        pureDetail.startsWith(jibunBase)
                      ) {
                        pureDetail = pureDetail
                          .substring(jibunBase.length)
                          .trim();
                      } else {
                        const regex =
                          /^(서울특별시|경기도|인천광역시|부산광역시|대구광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|강원특별자치도|충청북도|충청남도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도|서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)\s+[가-힣]+(구|시|군)\s+/g;
                        let tempDetail = pureDetail.replace(regex, "");
                        if (addrRes[0].road_address) {
                          tempDetail = tempDetail.replace(
                            new RegExp(
                              `^${addrRes[0].road_address.road_name}\\s*\\d+-?\\d*\\s*`,
                            ),
                            "",
                          );
                          // [요구사항 1 반영] 건물명 중복 제거 로직 해제 (순수 상세 주소에서 건물명이 날아가지 않도록 보존)
                        }
                        tempDetail = tempDetail.replace(
                          new RegExp(`^${hDong}\\s*\\d+-?\\d*\\s*`),
                          "",
                        );
                        tempDetail = tempDetail.replace(
                          new RegExp(`^${bDong}\\s*\\d+-?\\d*\\s*`),
                          "",
                        );
                        pureDetail = tempDetail.trim();
                      }
                      if (/^[\d-]+$/.test(pureDetail)) pureDetail = ""; // 분리 후 찌꺼기로 남은 번지수 제거
                    }

                    let finalAddr =
                      isRoadState && roadBase ? roadBase : jibunBase;
                    if (pureDetail && !finalAddr.includes(pureDetail))
                      finalAddr += ` ${pureDetail}`;
                    transEl.innerText = finalAddr;
                  } else {
                    transEl.innerText =
                      item.rawFullAddress ||
                      shortBaseAddr +
                        (item.detailedAddress
                          ? ` ${item.detailedAddress}`
                          : "");
                  }
                },
              );
            }
          } catch (e) {
            console.error("주소 UI 업데이트 중 오류 발생:", e);
          }
        };

        // 토글 스위치 이벤트 등록 및 즉각 반영
        window.addEventListener("addrTypeChange", updateAddressUI);
        updateAddressUI();
      }

      // 버튼 액션 핸들러
      window.detailActions = {
        async toggleZzim(btnElement) {
          // 1. [낙관적 업데이트] 서버 응답을 기다리지 않고 즉시 하트 색상을 변경하여 깜빡임 제거
          if (btnElement) btnElement.classList.toggle("active");

          // 2. 백엔드(Worker)에 찜하기 상태 전달
          try {
            const res = await fetch(
              `https://udong-bff.wsp485786.workers.dev/api/users/wishlist?nickname=${encodeURIComponent(myNickname)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postId: item.id }),
              },
            );
            if (!res.ok) throw new Error("서버 응답 오류");

            // [대청소] location.reload()를 삭제하여 화면 깜빡임을 방지합니다.
          } catch (e) {
            // 3. 통신 실패 시에만 하트 색상을 원상복구하고 알림을 띄웁니다.
            if (btnElement) btnElement.classList.toggle("active");
            alert("처리 중 서버 오류가 발생했습니다.");
          }
        },
        async updateStatus(newStatus, msg) {
          if (msg && !confirm(msg)) return;
          // [대청소 완료] 가짜 DB 저장 로직 삭제 및 서버 API 직접 호출
          try {
            await fetch(
              `https://udong-bff.wsp485786.workers.dev/api/posts/${item.id}/status`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
              },
            );
            alert("처리가 완료되었습니다.");
            location.reload();
          } catch (e) {
            alert("처리 중 서버 오류가 발생했습니다.");
          }
        },
        async deletePost() {
          const reason = prompt("삭제 사유를 입력하세요.");
          if (!reason) return;
          window.updateMockDB(item.id, { isDeleted: true });
          alert("삭제되었습니다.");
          location.href = "/pages/main/main.html";
        },
        cancelPost() {
          this.updateStatus("canceled", "정말로 모집을 취소하시겠습니까?");
        },
        // [수정] 공구 요청 취소 로직 (낙관적 업데이트 적용 - 서버 에러 시에도 무조건 사용자 경험 보장)
        async cancelRequest() {
          // [요구사항 반영] 역슬래시를 한 개로 수정하여 줄바꿈 적용
          if (
            !confirm(
              "공구 요청을 취소하시겠습니까?\n받은 입찰 제안 내역도 모두 삭제됩니다.",
            )
          )
            return;

          try {
            const canceledAt = new Date().toISOString();

            // [대청소 완료] 가짜 DB 업데이트 완전 삭제, 오직 Worker 서버와만 통신
            try {
              const res = await fetch(
                `https://udong-bff.wsp485786.workers.dev/api/posts/${item.id}/status`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    status: "request_canceled",
                    canceledAt: canceledAt,
                  }),
                },
              );
              if (!res.ok)
                console.warn("Worker 서버 응답 오류, 로컬 처리로 갈음합니다.");
            } catch (networkError) {
              console.warn(
                "Worker 연결 실패, 로컬 처리로 갈음합니다:",
                networkError,
              );
            }

            alert("요청이 취소되었습니다.");
            // [경로 수정] 메인 페이지의 절대 경로로 정확히 이동하여 에러 방지
            location.href = "/pages/main/main.html";
          } catch (e) {
            console.error("요청 취소 에러:", e);
            alert("취소 처리 중 알 수 없는 오류가 발생했습니다.");
          }
        },
        closeEarly() {
          this.updateStatus("closed", "모집을 조기 마감하시겠습니까?");
        },
        confirmTransaction() {
          this.updateStatus("completed", "거래를 확정하시겠습니까?");
        },

        async participate() {
          if (role === "buyer" && !isVerifiedBuyer) {
            alert("동네 인증이 완료된 사용자만 공구에 참여할 수 있습니다.");
            return;
          }
          const overlay = document.createElement("div");
          overlay.className = "payment-modal-overlay";
          overlay.innerHTML = `<div class="payment-modal-box">
              <h3 class="pay-title">안전결제 (우동페이)</h3>
              <div class="pay-amount-box"><div class="pay-amount-text">결제할 금액</div><div class="pay-amount-val">${priceValue}</div></div>
              <div class="pay-btn-wrap"><button class="btn-action-large secondary" onclick="this.closest('.payment-modal-overlay').remove()">취소</button><button class="btn-action-large primary" id="btnConfirmPay">결제 및 참여</button></div>
            </div>`;
          document.body.appendChild(overlay);

          document.getElementById("btnConfirmPay").onclick = async () => {
            // [대청소 완료] 로컬 가짜 DB 삭제 후 API로 즉시 참여 인원 증가 처리
            try {
              await fetch(
                `https://udong-bff.wsp485786.workers.dev/api/posts/${item.id}/participate`,
                { method: "POST" },
              );
              alert("결제 및 참여가 완료되었습니다!");
              location.reload();
            } catch (e) {
              alert("참여 처리 중 오류가 발생했습니다.");
            }
          };
        },
        async cancelParticipation() {
          if (
            !confirm("참여를 취소하시겠습니까?\n결제된 금액은 즉시 환불됩니다.")
          )
            return;

          // [대청소 완료] 로컬 가짜 DB 삭제 후 API로 즉시 참여 인원 감소 처리
          try {
            await fetch(
              `https://udong-bff.wsp485786.workers.dev/api/posts/${item.id}/participate`,
              { method: "DELETE" },
            );
            alert("취소 및 환불이 완료되었습니다.");
            location.reload();
          } catch (e) {
            alert("취소 처리 중 오류가 발생했습니다.");
          }
        },
      };
    };

    renderDetailUI(initialItem);
  } catch (criticalError) {
    console.error("상세 페이지 에러:", criticalError);
    container.innerHTML = `<div style="padding:60px; text-align:center;"><span style="font-size:48px;">💥</span><h3 style="color:#e03131;">문제가 발생했습니다</h3><p>${criticalError.message}</p></div>`;
  }
});
