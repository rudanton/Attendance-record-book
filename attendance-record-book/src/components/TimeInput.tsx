"use client";

import { Timestamp } from 'firebase/firestore';
import { useEffect, useRef } from 'react';

interface TimeInputProps {
  name: string;
  value: Timestamp | string | null | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
}

const formatTimestampToTime = (timestamp: Timestamp | string | null | undefined): string => {
  if (!timestamp) return '';
  if (typeof timestamp === 'string') return timestamp;
  try {
    const date = timestamp.toDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (isNaN(hours) || isNaN(minutes)) return '';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

export default function TimeInput({
  name,
  value,
  onChange,
  onBlur,
  className = "p-2 border rounded-md w-32",
  placeholder = "HH:mm (24h)"
}: TimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPosRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (cursorPosRef.current !== null && inputRef.current) {
      const pos = cursorPosRef.current;
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(pos, pos);
        }
      });
      cursorPosRef.current = null;
    }
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const start = input.selectionStart || 0;
    let val = input.value;
    
    // 숫자와 콜론만 허용
    let cleaned = val.replace(/[^\d:]/g, '');
    
    // 길이 제한
    if (cleaned.length > 5) {
      cleaned = cleaned.substring(0, 5);
    }
    
    // 커서 위치 계산
    const removedCount = val.length - cleaned.length;
    cursorPosRef.current = Math.max(0, start - removedCount);
    
    // 이벤트 생성
    const syntheticEvent = {
      ...e,
      target: { ...input, value: cleaned, name }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onChange(syntheticEvent);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      name={name}
      value={formatTimestampToTime(value)}
      onChange={handleChange}
      onBlur={onBlur}
      className={className}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
