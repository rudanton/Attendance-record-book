import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Firebase 서비스 계정 키 파일 경로 (프로젝트 루트 디렉토리에 있어야 합니다)
const serviceAccountPath = path.resolve(__dirname, '../../firebase-admin-key.json');
const serviceAccount = require(serviceAccountPath);

// Firebase Admin SDK 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

interface Branch {
  branchId: string;
  branchName: string;
}

const branchesToAdd: Omit<Branch, 'branchId'>[] = [
  { branchName: '본점' },
  { branchName: '강남점' },
  { branchName: '홍대점' },
  { branchName: '부산점' },
];

async function addBranchesToFirestore() {
  console.log('Firestore에 지점 데이터 추가를 시작합니다...');
  const batch = db.batch();
  const branchesRef = db.collection('branches');
  let branchCount = 0;

  for (const branchData of branchesToAdd) {
    const branchId = uuidv4(); // 고유 ID 생성
    const newBranchRef = branchesRef.doc(branchId);
    batch.set(newBranchRef, { branchId, ...branchData });
    branchCount++;
    console.log(`- 지점 추가: ${branchData.branchName} (ID: ${branchId})`);
  }

  try {
    await batch.commit();
    console.log(`✅ ${branchCount}개의 지점 데이터가 성공적으로 Firestore에 추가되었습니다.`);
  } catch (error) {
    console.error('❌ 지점 데이터 추가 중 오류 발생:', error);
  } finally {
    // 스크립트 종료
    process.exit(0);
  }
}

addBranchesToFirestore();
