import axios from 'axios';

export const uploadAudio = async (audioPath) => {
  const formData = new FormData();

  let cleanUri = audioPath;
  if (audioPath.startsWith('file://')) {
    cleanUri = audioPath.replace('file://', '');
  }

  const fileExtension = cleanUri.split('.').pop();
  const fileType = fileExtension === 'mp3' ? 'audio/mp3' : `audio/${fileExtension}`;

  formData.append('file', {
    uri: `file://${cleanUri}`,
    type: fileType,
    name: `recording.${fileExtension}`,
  });

  try {
    const response = await axios.post('http://192.168.0.137:8000', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Accept: 'application/json',
      },
      timeout: 30000,
      
    });

    console.log('Transcription response:', response.data);
    return response.data.transcription;
  } catch (error) {
    console.error(' Upload error details:', error.message);
    if (error.response) {
      console.error(' Server responded with:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error(' No response received:', error.request);
    }
    return null;
  }
};