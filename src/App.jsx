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

// 샘플 맛집 데이터 - 세종시 지역
const sampleRestaurants = [
  {
    id: 1,
    name: "하여금 동국",
    rating: 4.5,
    address: "세종시 아름동",
    lat: 36.5153,
    lng: 127.2429,
    review: "분위기 좋고 음식도 맛있어요. 특히 파스타가 일품입니다."
  },
  {
    id: 2,
    name: "빌즈 세종",
    rating: 4.2,
    address: "세종시 도담동",
    lat: 36.5179,
    lng: 127.2585,
    review: "브런치 맛집으로 유명해요. 팬케이크 추천합니다!"
  }
];

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
  const [restaurants, setRestaurants] = useState(sampleRestaurants);
  const [filteredRestaurants, setFilteredRestaurants] = useState(sampleRestaurants);
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

  // 세종시 중심 좌표와 20km 범위 제한
  const mapCenter = [36.4795, 127.2891];


  useEffect(() => {
    // 검색어로 맛집 필터링
    const filtered = restaurants.filter(restaurant =>
      restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRestaurants(filtered);
  }, [searchTerm, restaurants]);

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
  const handleAddRestaurant = () => {
    if (newRestaurant.name && selectedPosition) {
      const restaurant = {
        id: Date.now(),
        name: newRestaurant.name,
        address: newRestaurant.address || '주소 미정',
        rating: newRestaurant.rating,
        review: newRestaurant.review || '',
        lat: selectedPosition[0],
        lng: selectedPosition[1]
      };
      setRestaurants([...restaurants, restaurant]);
      setNewRestaurant({ name: '', address: '', rating: 3.0, review: '' });
      setSelectedPosition(null);
      setShowAddForm(false);
      setIsAddingMode(false);
    }
  };

  // 맛집 삭제 핸들러
  const handleDeleteRestaurant = (id) => {
    if (confirm('정말로 이 맛집을 삭제하시겠습니까?')) {
      setRestaurants(restaurants.filter(restaurant => restaurant.id !== id));
    }
  };

  // 맛집 수정 시작 핸들러
  const handleStartEditRestaurant = (restaurant) => {
    setEditingRestaurant({ ...restaurant });
    setShowEditForm(true);
  };

  // 맛집 수정 완료 핸들러
  const handleEditRestaurant = () => {
    if (editingRestaurant && editingRestaurant.name) {
      setRestaurants(restaurants.map(restaurant => 
        restaurant.id === editingRestaurant.id ? editingRestaurant : restaurant
      ));
      setEditingRestaurant(null);
      setShowEditForm(false);
    }
  };

  // 카카오 지도 API 키 (환경변수에서 읽어오기)
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY;

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
        // 검색 결과로 주소와 위치 자동 업데이트
        setNewRestaurant(prev => ({
          ...prev,
          address: searchResult.address
        }));
        setSelectedPosition([searchResult.lat, searchResult.lng]);
        
        alert(`검색 완료!\n주소: ${searchResult.address}\n위치가 자동으로 업데이트되었습니다.`);
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
        // 검색 결과로 주소와 위치 자동 업데이트
        setEditingRestaurant(prev => ({
          ...prev,
          address: searchResult.address,
          lat: searchResult.lat,
          lng: searchResult.lng
        }));
        
        alert(`검색 완료!\n주소: ${searchResult.address}\n위치가 자동으로 업데이트되었습니다.`);
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

  // 카카오 장소 검색 API 호출 함수
  const searchPlaceAPI = async (keyword, lat, lng) => {
    try {
      // API 키가 설정되어 있지 않으면 데모 모드로 작동
      if (!KAKAO_API_KEY || KAKAO_API_KEY === 'YOUR_KAKAO_REST_API_KEY_HERE') {
        console.warn('카카오 API 키가 설정되지 않았습니다. 데모 모드로 작동합니다.');
        
        // 데모용: 가상의 검색 결과 반환
        if (Math.random() > 0.3) { // 70% 성공률
          return {
            address: `세종시 ${keyword} 근처 (데모)`,
            lat: lat + (Math.random() - 0.5) * 0.01,
            lng: lng + (Math.random() - 0.5) * 0.01
          };
        }
        return null;
      }

      // 실제 카카오 API 호출 (프록시 사용)
      const apiUrl = import.meta.env.DEV 
        ? `/api/kakao/v2/local/search/keyword.json` // 개발 환경: 프록시 사용
        : `https://dapi.kakao.com/v2/local/search/keyword.json`; // 프로덕션: 직접 호출
        
      const response = await fetch(
        `${apiUrl}?query=${encodeURIComponent(keyword)}&x=${lng}&y=${lat}&radius=5000&category_group_code=FD6`,
        {
          headers: {
            'Authorization': `KakaoAK ${KAKAO_API_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.documents && data.documents.length > 0) {
        const place = data.documents[0]; // 가장 가까운 결과 선택
        return {
          address: place.road_address_name || place.address_name,
          lat: parseFloat(place.y),
          lng: parseFloat(place.x),
          placeName: place.place_name,
          phone: place.phone
        };
      }
      
      return null;
    } catch (error) {
      // CORS 오류인 경우 사용자에게 안내
      if (error.message.includes('CORS')) {
        console.error('CORS 오류: 개발 서버에서는 CORS 프록시 설정이 필요할 수 있습니다.');
      }
      throw error;
    }
  };

  return (
    <div className="app-container">
      {/* 사용자 상태 표시 */}
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: isAddingMode ? '#4CAF50' : '#2196F3',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        zIndex: 1000,
        fontWeight: 'bold'
      }}>
        {isAddingMode ? '🎯 맛집 등록 모드' : '🔍 검색 모드'}
      </div>

      {/* 메인 헤더 */}
      <div className="header">
        <h1>세종시 맛집 공유 지도</h1>
        <div className="search-bar">
          <input
            type="text"
            placeholder="맛집 검색..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            className={`add-restaurant-btn ${isAddingMode ? 'active' : ''}`}
            onClick={() => setIsAddingMode(!isAddingMode)}
          >
            {isAddingMode ? '등록 취소' : '맛집 등록'}
          </button>
        </div>

        {/* 평점 표시 토글 */}
        <div className="rating-toggle">
          <button
            className={`rating-toggle-btn ${showRatingsOnMap ? 'active' : ''}`}
            onClick={() => setShowRatingsOnMap(!showRatingsOnMap)}
            title={showRatingsOnMap ? '지도에서 평점 숨기기' : '지도에 평점 표시하기'}
          >
            ⭐ {showRatingsOnMap ? '평점 표시 중' : '평점 표시'}
          </button>
        </div>

        {/* 상태 설명 */}
        <div style={{
          marginTop: '10px',
          fontSize: '14px',
          color: isAddingMode ? '#4CAF50' : '#666',
          fontWeight: 'bold'
        }}>
          {isAddingMode ? (
            <div>
              <span>🎯 십자선 커서가 표시됩니다.</span><br/>
              <span>지도에서 맛집 위치를 클릭하세요!</span>
            </div>
          ) : (
            <span>▷ 일반 모드: 맛집 검색 및 확인</span>
          )}
        </div>
      </div>

      {/* 지도 컨테이너 */}
      <div className={`map-container ${isAddingMode ? 'adding-mode' : ''}`}>
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
          {filteredRestaurants.map(restaurant => (
            <Marker 
              key={restaurant.id} 
              position={[restaurant.lat, restaurant.lng]}
            >
              {/* 평점 표시 툴팁 */}
              {showRatingsOnMap && (
                <Tooltip
                  permanent={true}
                  direction="top"
                  offset={[0, -10]}
                  className="rating-tooltip"
                >
                  <span className="rating-badge">{restaurant.rating}</span>
                </Tooltip>
              )}
              
              <Popup>
                <div className="restaurant-card">
                  <h4>{restaurant.name}</h4>
                  <p>⭐ {restaurant.rating}/5.0</p>
                  <p>📍 {restaurant.address}</p>
                  {restaurant.review && (
                    <div className="restaurant-review">
                      <p><strong>💭 평가:</strong></p>
                      <p>{restaurant.review}</p>
                    </div>
                  )}
                  <div className="popup-buttons">
                    <button 
                      className="edit-popup-btn"
                      onClick={() => handleStartEditRestaurant(restaurant)}
                    >
                      ✏️ 수정
                    </button>
                    <button 
                      className="delete-popup-btn"
                      onClick={() => handleDeleteRestaurant(restaurant.id)}
                    >
                      🗑️ 삭제
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 축척 표시 */}
          <ScaleControl position="bottomright" imperial={false} />
        </MapContainer>
      </div>

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

      {/* 하단 안내 */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h4>🍽️ 사용 방법</h4>
        <ol style={{ textAlign: 'left', marginTop: '10px' }}>
          <li><strong>검색:</strong> 입력창에 맛집명이나 주소 검색</li>
          <li><strong>등록:</strong> "맛집 등록" 버튼 → 커서 변경 → 지도 클릭 → 정보 입력</li>
          <li><strong>확인:</strong> 커서가 십자선으로 바뀌면 등록 모드 활성화</li>
        </ol>
        <p style={{ marginTop: '10px', color: '#28a745', fontWeight: 'bold' }}>
          현재 세종시 중심 20km 범위 내에서 표시됨
        </p>
      </div>
    </div>
  );
}

export default App;
