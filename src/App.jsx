import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ScaleControl, useMapEvents, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet 기본 마커 사용 - Babel 파싱 문제 해결
import L from 'leaflet';

// 기본 마커 아이콘 설정 시도 (실패하더라도 진행)
try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
} catch (error) {
  console.log('Default marker icons loaded');
}

// 커스텀 마커 아이콘 생성
const createCustomIcon = (color = 'red') => {
  return new L.Icon({
    iconUrl: `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png`,
    iconRetinaUrl: `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png`,
    shadowUrl: `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: `custom-marker-${color}`
  });
};

// 마커 아이콘들
const myRestaurantIcon = createCustomIcon('red');    // 내 맛집
const otherRestaurantIcon = createCustomIcon('blue'); // 다른 사용자 맛집

// API 기본 URL - 개발/프로덕션 자동 감지
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:8787' : '';

// API 함수들
const api = {
  // 맛집 목록 조회
  async getRestaurants(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/api/restaurants${queryString ? '?' + queryString : ''}`;
    const response = await fetch(url);
    return response.json();
  },
  
  // 맛집 등록
  async createRestaurant(data) {
    const response = await fetch(`${API_BASE_URL}/api/restaurants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // 맛집 수정
  async updateRestaurant(id, data) {
    const response = await fetch(`${API_BASE_URL}/api/restaurants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // 맛집 삭제
  async deleteRestaurant(id, userId) {
    const response = await fetch(`${API_BASE_URL}/api/restaurants/${id}/${userId}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  // 사용자 등록
  async registerUser(nickname, password) {
    const response = await fetch(`${API_BASE_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });
    return response.json();
  },

  // 사용자 로그인
  async loginUser(nickname, password) {
    const response = await fetch(`${API_BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password })
    });
    return response.json();
  },

  // 사용자 정보 조회
  async getUserInfo(nickname) {
    const response = await fetch(`${API_BASE_URL}/api/users/${nickname}`);
    return response.json();
  }
};

// 지도 클릭 이벤트 처리 컴포넌트
function MapClickHandler({ isAddingMode, onMapClick }) {
  useMapEvents({
    click: (event) => {
      if (isAddingMode) {
        onMapClick(event);
      }
    }
  });
  return null;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    address: '',
    rating: 3.0,
    review: ''
  });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showRatingsOnMap, setShowRatingsOnMap] = useState(false);
  
  // 새로 추가되는 상태들
  const [currentUser, setCurrentUser] = useState(null); // 현재 로그인한 사용자
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [viewingUser, setViewingUser] = useState(null); // 현재 보고 있는 사용자 페이지
  const [viewMode, setViewMode] = useState('all'); // 'all', 'user', 'aggregated'
  const [selectedRestaurant, setSelectedRestaurant] = useState(null); // 사이드 패널용

  // 세종시 중심 좌표와 20km 범위 제한
  const mapCenter = [36.4795, 127.2891];


  // 컴포넌트 마운트시 URL 파싱 및 데이터 로드
  useEffect(() => {
    // URL 파싱
    const path = window.location.pathname;
    const userMatch = path.match(/^\/u\/([^\/]+)$/);
    
    // 로컬스토리지에서 사용자 정보 복원
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    
    if (userMatch) {
      const nickname = userMatch[1];
      setViewingUser(nickname);
      setViewMode('user');
      loadUserInfo(nickname);
      loadRestaurants('user', nickname);
    } else {
      setViewMode('all'); // 기본은 전체 모드 (집계 아닌 일반)
      loadRestaurants('all', null);
    }
  }, []);

  // URL 변경 감지
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const userMatch = path.match(/^\/u\/([^\/]+)$/);
      
      if (userMatch) {
        const nickname = userMatch[1];
        setViewingUser(nickname);
        setViewMode('user');
        loadUserInfo(nickname);
        loadRestaurants('user', nickname);
      } else {
        setViewingUser(null);
        setViewMode('all');
        loadRestaurants('all', null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 검색어 필터링
  useEffect(() => {
    const filtered = restaurants.filter(restaurant =>
      restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRestaurants(filtered);
  }, [searchTerm, restaurants]);

  // API 데이터 로드
  const loadRestaurants = async (mode = null, user = null) => {
    try {
      const currentMode = mode || viewMode;
      const currentUser = user || viewingUser;
      
      let data;
      if (currentMode === 'user' && currentUser) {
        // 특정 사용자의 맛집 조회
        const userInfo = await api.getUserInfo(currentUser);
        if (userInfo.success) {
          data = await api.getRestaurants({ userId: userInfo.user.id });
        } else {
          data = [];
        }
      } else if (currentMode === 'aggregated') {
        // 집계된 맛집 목록 조회
        data = await api.getRestaurants({ aggregated: 'true' });
      } else {
        // 전체 맛집 목록 조회 (기본)
        data = await api.getRestaurants();
      }
      
      setRestaurants(data);
      setFilteredRestaurants(data);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  // 사용자 정보 로드
  const loadUserInfo = async (nickname) => {
    try {
      const result = await api.getUserInfo(nickname);
      if (!result.success) {
        // 사용자가 없으면 메인 페이지로 리다이렉트
        window.history.pushState({}, '', '/');
        setViewingUser(null);
        setViewMode('aggregated');
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
    }
  };

  // 페이지 이동 함수
  const navigateToUser = (nickname) => {
    window.history.pushState({}, '', `/u/${nickname}`);
    setViewingUser(nickname);
    setViewMode('user');
    loadUserInfo(nickname);
    loadRestaurants('user', nickname);
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setViewingUser(null);
    setViewMode('all');
    loadRestaurants('all', null);
  };

  // 내 맛집 등록하기 (기존 맛집 정보로 모달 열기)
  const handleAddToMyRestaurants = (restaurant) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }
    
    // 기존 맛집 정보로 폼 미리 채우기
    setNewRestaurant({
      name: restaurant.name,
      address: restaurant.address,
      rating: 3.0, // 기본 평점
      review: '',  // 빈 리뷰
      kakaoPlaceId: restaurant.kakao_place_id
    });
    
    // 위치 설정
    setSelectedPosition([restaurant.lat, restaurant.lng]);
    
    // 등록 모달 열기
    setShowAddForm(true);
    
    // 사이드 패널 닫기
    setSelectedRestaurant(null);
  };

  // 사용자 인증 함수들
  const handleLogin = async (nickname, password) => {
    try {
      const result = await api.loginUser(nickname, password);
      if (result.success) {
        const user = { id: result.userId, nickname: result.nickname };
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        setShowLoginForm(false);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  };

  const handleRegister = async (nickname, password) => {
    try {
      const result = await api.registerUser(nickname, password);
      if (result.success) {
        const user = { id: result.userId, nickname: result.nickname };
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        setShowLoginForm(false);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    navigateToHome();
  };

  // 등록 모드 상태 변경 시 커서 및 body 스타일 변경
  useEffect(() => {
    if (isAddingMode) {
      // 등록 모드: 십자선 커서
      document.body.classList.add('adding-mode');
      document.body.style.cursor = 'crosshair';
    } else {
      // 일반 모드: 기본 커서
      document.body.classList.remove('adding-mode');
      document.body.style.cursor = 'auto';
    }

    // 컴포넌트 언마운트 시 커서 리셋
    return () => {
      document.body.classList.remove('adding-mode');
      document.body.style.cursor = 'auto';
    };
  }, [isAddingMode]);

  // 주소 생성 함수 (실제 주소 변환)
  const generateAddressFromPosition = async (position) => {
    const [lat, lng] = position;
    
    try {
      // Nominatim API 사용하여 실제 주소 변환
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`
      );
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        let address = '';
        
        // 한국 주소 형식에 맞게 조합
        if (addr.city || addr.town || addr.village) {
          address += (addr.city || addr.town || addr.village) + ' ';
        }
        if (addr.borough || addr.district) {
          address += (addr.borough || addr.district) + ' ';
        }
        if (addr.neighbourhood || addr.suburb) {
          address += (addr.neighbourhood || addr.suburb) + ' ';
        }
        if (addr.road || addr.street) {
          address += (addr.road || addr.street);
        }
        if (addr.house_number) {
          address += ' ' + addr.house_number;
        }
        
        return address.trim() || data.display_name;
      }
    } catch (error) {
      console.error('주소 변환 실패:', error);
    }
    
    // 실패 시 기본 주소 생성
    const latInt = Math.floor(lat);
    const lngInt = Math.floor(lng);
    return `세종시 ${latInt}번가 ${lngInt}번길`;
  };

  // 지도 클릭 핸들러
  const handleMapClick = async (event) => {
    if (isAddingMode) {
      const position = [event.latlng.lat, event.latlng.lng];
      console.log('위치 선택됨:', position);

      // 위치 저장
      setSelectedPosition(position);

      // 주소 로딩 상태 표시
      setNewRestaurant(prev => ({
        ...prev,
        address: '주소를 가져오는 중...'
      }));

      setShowAddForm(true);
      setIsAddingMode(false);

      // 주소 자동 입력 (비동기)
      try {
        const generatedAddress = await generateAddressFromPosition(position);
        setNewRestaurant(prev => ({
          ...prev,
          address: generatedAddress
        }));
      } catch (error) {
        console.error('주소 생성 실패:', error);
        setNewRestaurant(prev => ({
          ...prev,
          address: '주소 불러오기 실패'
        }));
      }
    }
  };

  // 맛집 등록 핸들러
  const handleAddRestaurant = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      setShowLoginForm(true);
      return;
    }

    if (newRestaurant.name && selectedPosition) {
      try {
        const restaurantData = {
          name: newRestaurant.name,
          address: newRestaurant.address || '주소 미정',
          rating: newRestaurant.rating,
          review: newRestaurant.review || '',
          lat: selectedPosition[0],
          lng: selectedPosition[1],
          userId: currentUser.id,
          kakaoPlaceId: newRestaurant.kakaoPlaceId || null
        };
        
        await api.createRestaurant(restaurantData);
        await loadRestaurants(); // 데이터 다시 로드
        
        setNewRestaurant({ name: '', address: '', rating: 3.0, review: '', kakaoPlaceId: null });
        setSelectedPosition(null);
        setShowAddForm(false);
        setIsAddingMode(false);
      } catch (error) {
        console.error('맛집 등록 실패:', error);
        alert('맛집 등록에 실패했습니다.');
      }
    }
  };

  // 맛집 삭제 핸들러
  const handleDeleteRestaurant = async (id, restaurantUserId) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (currentUser.id !== restaurantUserId) {
      alert('본인이 등록한 맛집만 삭제할 수 있습니다.');
      return;
    }

    if (confirm('정말로 이 맛집을 삭제하시겠습니까?')) {
      try {
        await api.deleteRestaurant(id, currentUser.id);
        await loadRestaurants(); // 데이터 다시 로드
        setSelectedRestaurant(null); // 사이드 패널 닫기
      } catch (error) {
        console.error('맛집 삭제 실패:', error);
        alert('맛집 삭제에 실패했습니다.');
      }
    }
  };

  // 맛집 수정 시작 핸들러
  const handleStartEditRestaurant = (restaurant) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (currentUser.id !== restaurant.user_id) {
      alert('본인이 등록한 맛집만 수정할 수 있습니다.');
      return;
    }

    setEditingRestaurant({ ...restaurant });
    setShowEditForm(true);
  };

  // 맛집 수정 완료 핸들러
  const handleEditRestaurant = async () => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (editingRestaurant && editingRestaurant.name) {
      try {
        await api.updateRestaurant(editingRestaurant.id, {
          name: editingRestaurant.name,
          address: editingRestaurant.address,
          rating: editingRestaurant.rating,
          review: editingRestaurant.review,
          lat: editingRestaurant.lat,
          lng: editingRestaurant.lng,
          userId: currentUser.id,
          kakaoPlaceId: editingRestaurant.kakao_place_id
        });
        await loadRestaurants(); // 데이터 다시 로드
        setEditingRestaurant(null);
        setShowEditForm(false);
        setSelectedRestaurant(null); // 사이드 패널도 업데이트
      } catch (error) {
        console.error('맛집 수정 실패:', error);
        alert('맛집 수정에 실패했습니다.');
      }
    }
  };

  // 카카오 API는 이제 Worker 프록시를 통해 호출됩니다

  // 장소 검색 함수 (새 맛집 등록용)
  const handleSearchPlace = async (placeName) => {
    if (!placeName.trim()) return;
    
    setIsSearching(true);
    try {
      // 현재 선택된 위치 또는 세종시 중심 좌표 사용
      const searchLat = selectedPosition ? selectedPosition[0] : mapCenter[0];
      const searchLng = selectedPosition ? selectedPosition[1] : mapCenter[1];
      
      const searchResult = await searchPlaceAPI(placeName, searchLat, searchLng);
      
      if (searchResult) {
        // 검색 결과로 이름, 주소, 위치, place_id 자동 업데이트
        setNewRestaurant(prev => ({
          ...prev,
          name: searchResult.placeName,
          address: searchResult.address,
          kakaoPlaceId: searchResult.placeId
        }));
        setSelectedPosition([searchResult.lat, searchResult.lng]);
        
        alert(`검색 완료!\n업체명: ${searchResult.placeName}\n주소: ${searchResult.address}\n위치가 자동으로 업데이트되었습니다.`);
      } else {
        alert('검색 결과가 없습니다. 다른 키워드로 시도해보세요.');
      }
    } catch (error) {
      console.error('장소 검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 장소 검색 함수 (맛집 수정용)
  const handleSearchPlaceForEdit = async (placeName) => {
    if (!placeName.trim()) return;
    
    setIsSearching(true);
    try {
      // 현재 수정 중인 맛집의 위치 사용
      const searchLat = editingRestaurant.lat;
      const searchLng = editingRestaurant.lng;
      
      const searchResult = await searchPlaceAPI(placeName, searchLat, searchLng);
      
      if (searchResult) {
        // 검색 결과로 이름, 주소, 위치, place_id 자동 업데이트
        setEditingRestaurant(prev => ({
          ...prev,
          name: searchResult.placeName,
          address: searchResult.address,
          lat: searchResult.lat,
          lng: searchResult.lng,
          kakao_place_id: searchResult.placeId
        }));
        
        alert(`검색 완료!\n업체명: ${searchResult.placeName}\n주소: ${searchResult.address}\n위치가 자동으로 업데이트되었습니다.`);
      } else {
        alert('검색 결과가 없습니다. 다른 키워드로 시도해보세요.');
      }
    } catch (error) {
      console.error('장소 검색 오류:', error);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  // 카카오 장소 검색 API 호출 함수 (Worker 프록시 사용)
  const searchPlaceAPI = async (keyword, lat, lng) => {
    try {
      // Worker API 프록시를 통해 카카오 API 호출
      const apiUrl = API_BASE_URL + '/api/search-place';
      const searchQuery = `${keyword} 세종시 맛집`; // 검색어에 지역 추가
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: searchQuery })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API 호출 실패: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 카카오 API 응답 처리
      if (data.documents && data.documents.length > 0) {
        // 현재 위치(lat, lng)에서 가장 가까운 결과 선택
        const calculateDistance = (lat1, lng1, lat2, lng2) => {
          const R = 6371; // 지구 반지름 (km)
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };

        let closestPlace = data.documents[0];
        let minDistance = calculateDistance(lat, lng, parseFloat(data.documents[0].y), parseFloat(data.documents[0].x));

        for (const place of data.documents) {
          const distance = calculateDistance(lat, lng, parseFloat(place.y), parseFloat(place.x));
          if (distance < minDistance) {
            minDistance = distance;
            closestPlace = place;
          }
        }
        
        const selectedPlace = closestPlace;
        
        return {
          address: selectedPlace.road_address_name || selectedPlace.address_name,
          lat: parseFloat(selectedPlace.y),
          lng: parseFloat(selectedPlace.x),
          placeName: selectedPlace.place_name,
          phone: selectedPlace.phone || '',
          placeId: selectedPlace.id
        };
      }
      
      return null;
    } catch (error) {
      console.error('카카오 장소 검색 오류:', error);
      throw error;
    }
  };

  return (
    <div className="app-container">
      {/* 상단 고정 컨트롤 바 */}
      <div className="sticky-controls">
        <input
          type="text"
          placeholder="맛집 검색..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <button
          className={`add-restaurant-btn ${isAddingMode ? 'active' : ''}`}
          onClick={() => {
            if (!currentUser) {
              alert('로그인이 필요합니다.');
              setShowLoginForm(true);
              return;
            }
            setIsAddingMode(!isAddingMode);
          }}
        >
          {isAddingMode ? '등록 취소' : '맛집 등록'}
        </button>
        
        <button
          className={`rating-toggle-btn ${showRatingsOnMap ? 'active' : ''}`}
          onClick={() => setShowRatingsOnMap(!showRatingsOnMap)}
          title={showRatingsOnMap ? '지도에서 평점 숨기기' : '지도에 평점 표시하기'}
        >
          ⭐ {showRatingsOnMap ? '평점 표시 중' : '평점 표시'}
        </button>

        {/* 모드 전환 버튼 */}
        <div className="mode-buttons">
          <button
            className={`mode-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={navigateToHome}
            title="전체 맛집 보기"
          >
            전체
          </button>
          {currentUser && (
            <button
              className={`mode-btn ${viewMode === 'user' && viewingUser === currentUser.nickname ? 'active' : ''}`}
              onClick={() => navigateToUser(currentUser.nickname)}
              title="내 맛집만 보기"
            >
              내 맛집
            </button>
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="user-info">
          {currentUser ? (
            <div className="user-menu">
              <span className="user-name">안녕하세요, {currentUser.nickname}님!</span>
              <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            <button className="login-btn" onClick={() => setShowLoginForm(true)}>
              로그인 / 가입
            </button>
          )}
        </div>
      </div>

      {/* 지도 컨테이너 */}
      <div className={`full-map-container ${isAddingMode ? 'adding-mode' : ''}`}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          maxZoom={18}
          minZoom={13}
          scrollWheelZoom={{ smooth: true, sensitivity: 0.5 }}
          style={{
            height: '100%',
            width: '100%'
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {/* 지도 클릭 이벤트 처리 */}
          <MapClickHandler isAddingMode={isAddingMode} onMapClick={handleMapClick} />

          {/* 마커 표시 */}
          {filteredRestaurants.map(restaurant => {
            // 내가 등록한 맛집인지 확인
            const hasMyReview = currentUser && restaurant.reviews && 
              restaurant.reviews.some(review => review.user_id === currentUser.id);
            
            return (
              <Marker 
                key={restaurant.id} 
                position={[restaurant.lat, restaurant.lng]}
                icon={hasMyReview ? myRestaurantIcon : otherRestaurantIcon}
                eventHandlers={{
                  click: () => {
                    setSelectedRestaurant(restaurant);
                  }
                }}
              >
              {/* 평점 표시 툴팁 */}
              {showRatingsOnMap && (
                <Tooltip
                  permanent={true}
                  direction="top"
                  offset={[0, -10]}
                  className="rating-tooltip"
                >
                  <span className="rating-badge">
                    {viewMode === 'aggregated' && restaurant.review_count > 1 
                      ? `${restaurant.avg_rating?.toFixed(1)}(${restaurant.review_count})`
                      : restaurant.rating || restaurant.avg_rating?.toFixed(1)}
                  </span>
                </Tooltip>
              )}
              </Marker>
            );
          })}

          {/* 축척 표시 */}
          <ScaleControl position="bottomright" imperial={false} />
        </MapContainer>
      </div>

      {/* 사이드 패널 */}
      {selectedRestaurant && (
        <div className="side-panel">
          <div className="side-panel-header">
            <h3>{selectedRestaurant.name}</h3>
            <button 
              className="close-panel-btn"
              onClick={() => setSelectedRestaurant(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="side-panel-content">
            {selectedRestaurant.reviews && selectedRestaurant.reviews.length > 0 ? (
              // 집계 모드: 여러 리뷰 표시
              <div className="aggregated-reviews">
                <div className="restaurant-summary">
                  <div className="restaurant-rating">
                    ⭐ {selectedRestaurant.avg_rating?.toFixed(1)}/5.0 
                    ({selectedRestaurant.review_count}개 리뷰)
                  </div>
                  <div className="restaurant-address">📍 {selectedRestaurant.address}</div>
                </div>
                
                <div className="reviews-list">
                  <h4>💭 리뷰 목록</h4>
                  {selectedRestaurant.reviews.map((review, index) => (
                    <div key={index} className="review-item-oneline">
                      <div className="review-content-oneline">
                        <span className="review-text">
                          "{review.review || '평점만 등록'}", {review.nickname || '익명'} ({new Date(review.created_at).toLocaleDateString()})
                        </span>
                        <span className="review-rating">⭐ {review.rating}</span>
                      </div>
                      {currentUser && currentUser.id === review.user_id && (
                        <div className="review-actions-inline">
                          <button 
                            className="edit-btn-small"
                            onClick={() => handleStartEditRestaurant({...review, ...selectedRestaurant})}
                          >
                            수정
                          </button>
                          <button 
                            className="delete-btn-small"
                            onClick={() => handleDeleteRestaurant(review.id, review.user_id)}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* 내 맛집 등록하기 버튼 */}
                {currentUser && (!selectedRestaurant.reviews || 
                  !selectedRestaurant.reviews.some(review => review.user_id === currentUser.id)) && (
                  <div className="add-my-restaurant-section">
                    <button 
                      className="add-my-restaurant-btn"
                      onClick={() => handleAddToMyRestaurants(selectedRestaurant)}
                    >
                      🍽️ 내 맛집으로 등록하기
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // 일반 모드: 단일 리뷰 표시
              <div className="single-review">
                <div className="restaurant-rating">⭐ {selectedRestaurant.rating}/5.0</div>
                <div className="restaurant-address">📍 {selectedRestaurant.address}</div>
                <div className="restaurant-author">
                  👤 {selectedRestaurant.nickname || '익명'} 
                  ({new Date(selectedRestaurant.created_at).toLocaleDateString()})
                </div>
                {selectedRestaurant.review && (
                  <div className="restaurant-review">
                    <h4>💭 평가</h4>
                    <p>{selectedRestaurant.review}</p>
                  </div>
                )}
                {currentUser && currentUser.id === selectedRestaurant.user_id && (
                  <div className="restaurant-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleStartEditRestaurant(selectedRestaurant)}
                    >
                      ✏️ 수정
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteRestaurant(selectedRestaurant.id, selectedRestaurant.user_id)}
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 맛집 등록 모달 */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>새 맛집 등록</h3>
            <div className="form-group">
              <label>맛집 이름 *</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                  placeholder="맛집 이름을 입력하세요"
                />
                <button 
                  type="button"
                  className="search-icon-btn"
                  onClick={() => handleSearchPlace(newRestaurant.name)}
                  disabled={!newRestaurant.name.trim() || isSearching}
                  title="카카오맵에서 검색"
                >
                  {isSearching ? '⏳' : '🔍'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>주소 (좌표 기반 자동 입력)</label>
              <input
                type="text"
                value={newRestaurant.address}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, address: e.target.value })}
                placeholder="주소를 입력하세요"
              />
            </div>
            <div className="form-group">
              <label>평점</label>
              <select
                value={newRestaurant.rating.toFixed(1)}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, rating: parseFloat(e.target.value) })}
              >
                <option value="1.0">1.0</option>
                <option value="1.5">1.5</option>
                <option value="2.0">2.0</option>
                <option value="2.5">2.5</option>
                <option value="3.0">3.0</option>
                <option value="3.5">3.5</option>
                <option value="4.0">4.0</option>
                <option value="4.5">4.5</option>
                <option value="5.0">5.0</option>
              </select>
            </div>
            <div className="form-group">
              <label>평가</label>
              <textarea
                value={newRestaurant.review}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, review: e.target.value })}
                placeholder="맛집에 대한 평가를 입력해주세요"
                rows="3"
              />
            </div>
            <div className="modal-buttons">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowAddForm(false);
                  setIsAddingMode(false);
                }}
              >
                취소
              </button>
              <button className="add-btn" onClick={handleAddRestaurant}>
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 맛집 수정 모달 */}
      {showEditForm && editingRestaurant && (
        <div className="modal-overlay" onClick={() => setShowEditForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>맛집 정보 수정</h3>
            <div className="form-group">
              <label>맛집 이름 *</label>
              <div className="input-with-icon">
                <input
                  type="text"
                  value={editingRestaurant.name}
                  onChange={(e) => setEditingRestaurant({ ...editingRestaurant, name: e.target.value })}
                  placeholder="맛집 이름을 입력하세요"
                />
                <button 
                  type="button"
                  className="search-icon-btn"
                  onClick={() => handleSearchPlaceForEdit(editingRestaurant.name)}
                  disabled={!editingRestaurant.name.trim() || isSearching}
                  title="카카오맵에서 검색"
                >
                  {isSearching ? '⏳' : '🔍'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>주소</label>
              <input
                type="text"
                value={editingRestaurant.address}
                onChange={(e) => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })}
                placeholder="주소를 입력하세요"
              />
            </div>
            <div className="form-group">
              <label>평점</label>
              <select
                value={editingRestaurant.rating.toFixed(1)}
                onChange={(e) => setEditingRestaurant({ ...editingRestaurant, rating: parseFloat(e.target.value) })}
              >
                <option value="1.0">1.0</option>
                <option value="1.5">1.5</option>
                <option value="2.0">2.0</option>
                <option value="2.5">2.5</option>
                <option value="3.0">3.0</option>
                <option value="3.5">3.5</option>
                <option value="4.0">4.0</option>
                <option value="4.5">4.5</option>
                <option value="5.0">5.0</option>
              </select>
            </div>
            <div className="form-group">
              <label>평가</label>
              <textarea
                value={editingRestaurant.review}
                onChange={(e) => setEditingRestaurant({ ...editingRestaurant, review: e.target.value })}
                placeholder="맛집에 대한 평가를 입력해주세요"
                rows="3"
              />
            </div>
            <div className="modal-buttons">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingRestaurant(null);
                }}
              >
                취소
              </button>
              <button className="add-btn" onClick={handleEditRestaurant}>
                수정하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로그인/회원가입 모달 */}
      {showLoginForm && (
        <LoginModal
          onLogin={handleLogin}
          onRegister={handleRegister}
          onClose={() => setShowLoginForm(false)}
        />
      )}

    </div>
  );
}

// 로그인/회원가입 모달 컴포넌트
function LoginModal({ onLogin, onRegister, onClose }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!nickname.trim() || !password.trim()) {
      setError('닉네임과 패스워드를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      setError('패스워드가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }

    try {
      const result = isLoginMode 
        ? await onLogin(nickname.trim(), password)
        : await onRegister(nickname.trim(), password);
      
      if (result.success) {
        onClose();
      } else {
        setError(result.error || '오류가 발생했습니다.');
      }
    } catch (error) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{isLoginMode ? '로그인' : '회원가입'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              required
            />
          </div>
          
          <div className="form-group">
            <label>패스워드</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="패스워드를 입력하세요"
              required
            />
          </div>
          
          {!isLoginMode && (
            <div className="form-group">
              <label>패스워드 확인</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="패스워드를 다시 입력하세요"
                required
              />
            </div>
          )}

          {error && (
            <div className="error-message" style={{ color: '#dc3545', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="add-btn" disabled={isLoading}>
              {isLoading ? '처리 중...' : (isLoginMode ? '로그인' : '가입하기')}
            </button>
          </div>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button 
            type="button"
            className="mode-switch-btn"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
              setPassword('');
              setConfirmPassword('');
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            {isLoginMode ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
