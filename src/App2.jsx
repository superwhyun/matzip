import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet 기본 마커 사용 (커스텀 아이콘 설정 제거)
import L from 'leaflet';

// 기본 마커 아이콘 설정 (예외 처리)
try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
} catch (e) {
  console.log('Using default Leaflet markers');
}

// 샘플 맛집 데이터 - 세종시 지역
const sampleRestaurants = [
  {
    id: 1,
    name: "하여금 동국",
    rating: 4.5,
    address: "세종시 아름동",
    lat: 36.5153,
    lng: 127.2429
  },
  {
    id: 2,
    name: "빌즈 세종",
    rating: 4.2,
    address: "세종시 도담동",
    lat: 36.5179,
    lng: 127.2585
  }
];

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [restaurants, setRestaurants] = useState(sampleRestaurants);
  const [filteredRestaurants, setFilteredRestaurants] = useState(sampleRestaurants);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    address: '',
    rating: 3.0
  });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isAddingMode, setIsAddingMode] = useState(false);

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

  useEffect(() => {
    // 등록 모드 상태 변경 시 body 클래스 토글
    if (isAddingMode) {
      document.body.classList.add('adding-mode');
    } else {
      document.body.classList.remove('adding-mode');
    }
  }, [isAddingMode]);

  // 지도 클릭 핸들러 (맛집 추가 위치 선택)
  const handleMapClick = (event) => {
    if (isAddingMode) {
      const position = [event.latlng.lat, event.latlng.lng];
      console.log('맛집 등록 위치 선택됨:', position);

      // 선택된 위치 기반 주소 생성
      const generatedAddress = generateAddressFromPosition(position);
      setNewRestaurant(prev => ({
        ...prev,
        address: generatedAddress
      }));

      setShowAddForm(true);
      setIsAddingMode(false);
    }
  };

  // 주소 생성 함수
  const generateAddressFromPosition = (position) => {
    const [lat, lng] = position;
    const latInt = Math.floor(lat);
    const lngInt = Math.floor(lng);
    return `세종시 ${latInt}번가 ${lngInt}번길`;
  };

  // 맛집 추가 핸들러
  const handleAddRestaurant = () => {
    if (newRestaurant.name && selectedPosition) {
      const restaurant = {
        id: Date.now(),
        name: newRestaurant.name,
        address: newRestaurant.address || '주소 미정',
        rating: newRestaurant.rating,
        lat: selectedPosition[0],
        lng: selectedPosition[1]
      };
      setRestaurants([...restaurants, restaurant]);
      setNewRestaurant({ name: '', address: '', rating: 3.0 });
      setSelectedPosition(null);
      setShowAddForm(false);
      setIsAddingMode(false);
    }
  };

  return (
    <div className="app-container">
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

        {/* 상태 설명 */}
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          {isAddingMode ? (
            <span>🎯 <strong>맛집 등록 모드:</strong> 지도를 클릭하여 맛집 위치를 선택하세요</span>
          ) : (
            <span>▶️ <strong>일반 모드:</strong> 검색하거나 맛집을 확인하세요</span>
          )}
        </div>
      </div>

      <div className={`map-container ${isAddingMode ? 'adding-mode' : ''}`}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          maxZoom={18}
          minZoom={13}
          style={{
            height: '100%',
            width: '100%'
          }}
          onClick={handleMapClick}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* 맛집 마커 */}
          {filteredRestaurants.map(restaurant => (
            <Marker key={restaurant.id} position={[restaurant.lat, restaurant.lng]}>
              <Popup>
                <div className="restaurant-card">
                  <div className="restaurant-name">{restaurant.name}</div>
                  <div className="restaurant-rating">⭐ {restaurant.rating}/5.0</div>
                  <div className="restaurant-address">{restaurant.address}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* 축척 표시 */}
          <ScaleControl position="bottomright" imperial={false} />
        </MapContainer>
      </div>

      {/* 맛집 추가 모달 */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>새 맛집 등록</h3>
            <div className="form-group">
              <label>맛집 이름 *</label>
              <input
                type="text"
                value={newRestaurant.name}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                placeholder="맛집 이름을 입력하세요"
              />
            </div>
            <div className="form-group">
              <label>주소</label>
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
                value={newRestaurant.rating}
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

      {/* 기능 안내 */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <h4>🍽️ 세종시 맛집 공유 사용법</h4>
        <ol style={{ textAlign: 'left', marginTop: '10px' }}>
          <li><strong>즐겨찾기:</strong> 검색창으로 맛집 찾기</li>
          <li><strong>등록하기:</strong> "맛집 등록" 버튼 클릭 → 십자선 커서 모드</li>
          <li><strong>위치 선택:</strong> 지도에서 맛집 위치 클릭</li>
          <li><strong>정보 입력:</strong> 이름, 평점 입력 후 등록</li>
        </ol>
        <p style={{ marginTop: '10px', color: '#28a745', fontWeight: 'bold' }}>
          🌟 현재 표시 범위: 세종시 중심 약 20km x 20km
        </p>
      </div>
    </div>
  );
}

export default App;
