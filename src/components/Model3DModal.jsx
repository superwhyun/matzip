import React, { useEffect, useState } from 'react';
import Model3DViewer from './Model3DViewer';

const Model3DModal = ({ modelUrl, isOpen, onClose, restaurantName }) => {
  // 3D 뷰어 마운트 상태 관리
  const [shouldRender3D, setShouldRender3D] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // 모달 열릴 때 백그라운드 스크롤 방지 및 3D 뷰어 마운트 제어
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // 모달이 열리면 지연 후 3D 뷰어 마운트
      const timer = setTimeout(() => {
        setShouldRender3D(true);
        setIsClosing(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = 'auto';
      // 모달이 닫히면 즉시 3D 뷰어 언마운트
      if (shouldRender3D) {
        setIsClosing(true);
        setShouldRender3D(false);
      }
    }
  }, [isOpen, shouldRender3D]);

  // 컴포넌트 언마운트 시 복원
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      setShouldRender3D(false);
      setIsClosing(false);
    };
  }, []);

  if (!isOpen) return null;

  // 모달 오버레이에서 휠 이벤트 차단
  const handleWheelEvent = (e) => {
    e.stopPropagation();
  };

  // 모달 닫기 핸들러
  const handleClose = () => {
    // 3D 뷰어를 먼저 언마운트
    setShouldRender3D(false);
    setIsClosing(true);
    
    // 짧은 지연 후 모달 닫기
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 50);
  };

  return (
    <div className="modal-overlay" onClick={handleClose} onWheel={handleWheelEvent}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{restaurantName} - 3D 모델</h3>
          <button className="modal-close-btn" onClick={handleClose}>×</button>
        </div>
        <div className="modal-body">
          {shouldRender3D && !isClosing && (
            <Model3DViewer 
              modelUrl={modelUrl} 
              width="100%" 
              height="600px"
              key={`${modelUrl}-${Date.now()}`}
            />
          )}
          {!shouldRender3D && !isClosing && (
            <div style={{height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div>로딩 준비 중...</div>
            </div>
          )}
          {isClosing && (
            <div style={{height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div>정리 중...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Model3DModal;