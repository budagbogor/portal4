
import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { AlertTriangle, Eye, EyeOff, ShieldCheck, CameraOff, Mic, MicOff, CheckCircle2 } from 'lucide-react';

interface ProctoringCamProps {
  onViolation: (type: 'LOOKING_AWAY' | 'NO_FACE') => void;
  isActive: boolean;
  onDeviceStatus?: (isReady: boolean) => void; // NEW: Callback for parent to know if devices are ready
}

const ProctoringCam: React.FC<ProctoringCamProps> = ({ onViolation, isActive, onDeviceStatus }) => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<'OK' | 'WARNING' | 'ERROR'>('OK');
  const [message, setMessage] = useState('Monitoring Aktif');
  const [permissionError, setPermissionError] = useState(false);
  const [micActive, setMicActive] = useState(false); // NEW: Mic state
  
  // Throttle violations to avoid spamming
  const lastViolationTime = useRef<number>(0);
  const violationStreak = useRef<number>(0);

  const handleUserMediaError = (error: string | DOMException) => {
    console.error("Camera Permission Error:", error);
    setStatus('ERROR');
    setMessage('Izin Kamera Ditolak');
    setPermissionError(true);
    if (onDeviceStatus) onDeviceStatus(false);
  };

  // Called when Webcam component successfully loads video stream
  const handleUserMedia = (stream: MediaStream) => {
      // 1. Video is ready.
      // 2. Now explicitly check Microphone permission
      if (!micActive) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                setMicActive(true);
                // Only report ready if we haven't detected other errors
                if (!permissionError && onDeviceStatus) onDeviceStatus(true);
            })
            .catch((err) => {
                console.error("Mic Permission Error:", err);
                setMessage('Mic Wajib Nyala');
                setStatus('ERROR');
                if (onDeviceStatus) onDeviceStatus(false);
            });
      } else {
          if (!permissionError && onDeviceStatus) onDeviceStatus(true);
      }
  };

  useEffect(() => {
    // Periodic check or Initial check to ensure both are active
    if (isActive) {
        navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(() => {
                setMicActive(true);
                setPermissionError(false);
                if (onDeviceStatus) onDeviceStatus(true);
            })
            .catch((e) => {
                console.error("Device check failed:", e);
                setMicActive(false);
                // Rough check for specific errors
                if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') {
                    setMessage('Cek Izin Device');
                    setStatus('ERROR');
                    setPermissionError(true);
                }
                if (onDeviceStatus) onDeviceStatus(false);
            });
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || permissionError) return;
    
    // Safety check if libraries loaded
    if (!FaceMesh || !Camera) {
        console.error("MediaPipe libraries failed to load correctly.");
        setStatus('ERROR');
        setMessage('Library Error');
        return;
    }

    let camera: any = null;
    let faceMesh: any = null;

    try {
        faceMesh = new FaceMesh({
        locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
        });

        faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
        const now = Date.now();

        // 1. Check if face exists
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            setStatus('ERROR');
            setMessage('Wajah Tidak Terdeteksi');
            violationStreak.current += 1;
            
            if (violationStreak.current > 30 && (now - lastViolationTime.current > 5000)) { // ~1 second of no face
            onViolation('NO_FACE');
            lastViolationTime.current = now;
            }
            return;
        }

        // 2. Head Pose Logic
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        
        const distToLeft = Math.abs(nose.x - leftEye.x);
        const distToRight = Math.abs(nose.x - rightEye.x);
        const totalDist = distToLeft + distToRight;
        const yawRatio = distToLeft / totalDist;

        let isLookingAway = false;
        let warningMsg = '';

        if (yawRatio < 0.25) {
            isLookingAway = true;
            warningMsg = 'Menoleh ke KIRI';
        } else if (yawRatio > 0.75) {
            isLookingAway = true;
            warningMsg = 'Menoleh ke KANAN';
        } 
        
        if (isLookingAway) {
            setStatus('WARNING');
            setMessage(warningMsg);
            violationStreak.current += 1;

            if (violationStreak.current > 20 && (now - lastViolationTime.current > 3000)) {
                onViolation('LOOKING_AWAY');
                lastViolationTime.current = now;
                violationStreak.current = 0; 
            }
        } else {
            setStatus('OK');
            setMessage('Fokus Terdeteksi');
            violationStreak.current = Math.max(0, violationStreak.current - 1); 
        }
        });

        if (webcamRef.current && webcamRef.current.video) {
            camera = new Camera(webcamRef.current.video, {
                onFrame: async () => {
                if (webcamRef.current && webcamRef.current.video && faceMesh) {
                    try {
                        await faceMesh.send({ image: webcamRef.current.video });
                    } catch (err) {
                        // Ignore send errors during shutdown
                    }
                }
                },
                width: 320,
                height: 240,
            });
            camera.start();
        }
    } catch (e) {
        console.error("Error initializing ProctoringCam:", e);
        setStatus('ERROR');
        setMessage('Init Error');
    }

    return () => {
        if (camera) try { camera.stop(); } catch (e) {}
        if (faceMesh) try { faceMesh.close(); } catch (e) {}
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.srcObject) {
            const stream = webcamRef.current.video.srcObject as MediaStream;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
    };
  }, [isActive, onViolation, permissionError]);

  if (permissionError) {
      return (
        <div className="fixed top-20 right-2 md:top-auto md:bottom-4 md:right-4 z-[50] flex flex-col items-end animate-bounce">
            <div className="bg-red-600 text-white px-3 py-2 rounded-lg shadow-xl flex items-center gap-2 text-xs font-bold border border-red-400">
                <CameraOff size={16} />
                <div>
                    <div>AKSES DITOLAK</div>
                    <div className="text-[9px] font-normal">Izinkan Kamera & Mic di browser</div>
                </div>
            </div>
        </div>
      )
  }

  return (
    <div className="fixed top-20 right-2 md:top-auto md:bottom-4 md:right-4 z-[50] flex flex-col items-end pointer-events-none transition-all duration-300">
       {/* Status Badge */}
       <div className={`mb-2 px-2 py-1 md:px-3 md:py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-[10px] md:text-xs font-bold transition-colors duration-300 backdrop-blur-sm bg-opacity-90
         ${status === 'OK' && micActive ? 'bg-green-100 text-green-700 border border-green-200' : 
           status === 'WARNING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse' : 
           'bg-red-100 text-red-700 border border-red-200 animate-bounce'}
       `}>
          {status === 'OK' && micActive ? <ShieldCheck size={12}/> : <AlertTriangle size={12}/>}
          {status === 'OK' && !micActive ? 'Mic Mati' : message}
       </div>

       {/* Camera Feed */}
       <div className={`relative w-24 h-18 md:w-32 md:h-24 bg-black rounded-lg overflow-hidden border-2 shadow-xl
         ${status === 'OK' && micActive ? 'border-green-400' : status === 'WARNING' ? 'border-yellow-400' : 'border-red-500'}
       `}>
          <Webcam
            ref={webcamRef}
            audio={false} // We check audio manually via getUserMedia to avoid echo, but verify permission
            width={128}
            height={96}
            screenshotFormat="image/jpeg"
            className="w-full h-full object-cover mirror-mode transform -scale-x-100" 
            onUserMediaError={handleUserMediaError}
            onUserMedia={handleUserMedia}
          />
          <div className="absolute bottom-0 left-0 w-full bg-black/60 text-[8px] text-white text-center py-0.5 flex items-center justify-center gap-1">
              <span>Proctoring</span>
              {micActive ? <Mic size={6} className="text-green-400"/> : <MicOff size={6} className="text-red-400"/>}
          </div>
       </div>
    </div>
  );
};

export default ProctoringCam;