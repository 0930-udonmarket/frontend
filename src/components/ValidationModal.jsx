import React from "react";
import styles from "../css/ValidationModal.module.css";

export default function ValidationModal({ isOpen, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrapper}>
          <div className={styles.iconBg} />
          <span className={styles.icon}>⚠️</span>
        </div>

        <h2 className={styles.title}>입력 정보 확인</h2>
        <p className={styles.message}>{message}</p>

        <button type="button" className={styles.confirmBtn} onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}