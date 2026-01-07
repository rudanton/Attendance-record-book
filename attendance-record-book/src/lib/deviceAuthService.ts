// src/lib/deviceAuthService.ts
import { db } from '@/firebase/config';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Config } from './types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const DEVICE_TOKEN_KEY = 'pizza_shop_device_token';
const CONFIG_DOC_ID = 'authorized_devices';

/**
 * Retrieves a unique device token from localStorage, or generates and stores a new one.
 * @returns The unique device token.
 */
export function getDeviceToken(): string {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = uuidv4();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

/**
 * Checks if the current device is authorized by comparing its token with the list in Firestore.
 * @returns Promise<boolean> True if authorized, false otherwise.
 */
export async function isDeviceAuthorized(): Promise<boolean> {
  try {
    const deviceToken = getDeviceToken();
    const configRef = doc(db, 'config', CONFIG_DOC_ID);
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      const configData = docSnap.data() as Config;
      return configData.tokens.includes(deviceToken);
    }
    return false; // No config document means no authorized devices
  } catch (error) {
    console.error("Error checking device authorization: ", error);
    return false;
  }
}

/**
 * Authorizes a device by adding its token to the Firestore list. (Admin function)
 * @param token The device token to authorize.
 * @returns Promise<void>
 */
export async function authorizeDevice(token: string): Promise<void> {
  try {
    const configRef = doc(db, 'config', CONFIG_DOC_ID);
    await updateDoc(configRef, {
      tokens: arrayUnion(token)
    }, { merge: true }); // Use merge:true to create the document if it doesn't exist
  } catch (error) {
    console.error("Error authorizing device: ", error);
    throw new Error("Failed to authorize device.");
  }
}

/**
 * Unauthorizes a device by removing its token from the Firestore list. (Admin function)
 * @param token The device token to unauthorize.
 * @returns Promise<void>
 */
export async function unauthorizeDevice(token: string): Promise<void> {
  try {
    const configRef = doc(db, 'config', CONFIG_DOC_ID);
    await updateDoc(configRef, {
      tokens: arrayRemove(token)
    });
  } catch (error) {
    console.error("Error unauthorizing device: ", error);
    throw new Error("Failed to unauthorize device.");
  }
}
