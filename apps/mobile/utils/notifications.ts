import { Platform } from 'react-native';
import Constants from 'expo-constants';

let Notifications: any = null;
if (Constants.appOwnership !== 'expo') {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('Failed to load expo-notifications', e);
  }
}

export async function requestNotificationPermissions() {
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function scheduleLocalPush(title: string, body: string, delaySeconds: number = 2) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { 
      seconds: delaySeconds, 
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL 
    },
  });
}
