
"use client";

import { useEffect, useRef, useState } from "react";
import { predictDigit } from "./predict";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCamera() {
    try {
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Use localhost or HTTPS."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        throw new Error("Camera preview could not be initialized.");
      }

      video.srcObject = stream;
      await video.play();

      setPrediction(null);
      setCameraOn(true);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setError(
        err instanceof Error
          ? err.message
          : "Could not access camera. Check camera permissions."
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function captureAndPredict() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0) {
      setError("Camera is not ready. Please wait and try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const ctx = canvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!ctx) {
        throw new Error("Could not process the camera image.");
      }

      // Crop a square from the center of the webcam frame.
      const size = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;

      canvas.width = 28;
      canvas.height = 28;

      ctx.drawImage(
        video,
        sx,
        sy,
        size,
        size,
        0,
        0,
        28,
        28
      );

      const image = ctx.getImageData(0, 0, 28, 28);
      const pixels: number[] = [];
      let brightness = 0;

      // Convert RGB pixels to grayscale.
      for (let i = 0; i < image.data.length; i += 4) {
        const gray = Math.round(
          0.299 * image.data[i] +
            0.587 * image.data[i + 1] +
            0.114 * image.data[i + 2]
        );

        pixels.push(gray);
        brightness += gray;
      }

      // MNIST convention: black background, white digit.
      // Invert a generally bright image, such as white paper.
      if (brightness / pixels.length > 127) {
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] = 255 - pixels[i];
        }
      }

      const digit = await predictDigit(pixels);
      setPrediction(digit);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Prediction failed. Check your ONNX model."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center px-5 py-12">
      <h1 className="text-4xl font-bold tracking-tight">
        MNIST Vision
      </h1>

      <p className="mt-3 text-center text-zinc-400">
        Handwritten digit recognition powered by your CNN.
      </p>

      <section className="mt-8 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${
              cameraOn ? "" : "hidden"
            }`}
          />

          {!cameraOn && (
            <p className="text-zinc-500">Camera is off</p>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-5 flex flex-wrap gap-3">
          {!cameraOn ? (
            <button
              onClick={startCamera}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200"
            >
              Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={captureAndPredict}
                disabled={loading}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Predicting..." : "Capture & Predict"}
              </button>

              <button
                onClick={stopCamera}
                disabled={loading}
                className="rounded-xl border border-zinc-700 px-5 py-3 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Stop Camera
              </button>
            </>
          )}
        </div>

        {prediction !== null && (
          <div className="mt-6 rounded-xl bg-zinc-800 p-5 text-center">
            <p className="text-sm text-zinc-400">
              Predicted digit
            </p>
            <p className="mt-2 text-6xl font-bold">
              {prediction}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 break-words text-sm text-red-400">
            {error}
          </p>
        )}
      </section>

      <div className="mt-6 max-w-xl text-center text-sm text-zinc-500">
        <p>
          For best results, write one large digit on white paper
          using a dark pen. Hold it in the center of the camera.
        </p>
        <p className="mt-2">
          The model was trained on MNIST, so webcam predictions
          may vary with lighting and handwriting.
        </p>
      </div>
    </main>
  );
}
