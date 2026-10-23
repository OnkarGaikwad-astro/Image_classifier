
import * as ort from "onnxruntime-web";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(
      "/mnist_cnn.onnx"
    );
  }

  return sessionPromise;
}

/**
 * Predict a handwritten digit from 28x28 grayscale pixels.
 * pixels: 784 values in the range 0-255.
 * Background should be black and the digit white.
 */
export async function predictDigit(
  pixels: number[]
): Promise<number> {
  if (pixels.length !== 784) {
    throw new Error(
      `Expected 784 pixels, received ${pixels.length}.`
    );
  }

  // Normalize pixel values to the range 0-1.
  const inputData = Float32Array.from(
    pixels,
    (pixel) => pixel / 255
  );

  const inputTensor = new ort.Tensor(
    "float32",
    inputData,
    [1, 1, 28, 28]
  );

  const session = await getSession();

  const results = await session.run({
    input: inputTensor,
  });

  const output = results["logits"];

  if (!output) {
    throw new Error(
      "Model output 'logits' was not found. Check your ONNX output name."
    );
  }

  const logits = output.data as Float32Array;

  if (logits.length !== 10) {
    throw new Error(
      `Expected 10 output values, received ${logits.length}.`
    );
  }

  let bestDigit = 0;

  for (let i = 1; i < 10; i++) {
    if (logits[i] > logits[bestDigit]) {
      bestDigit = i;
    }
  }

  return bestDigit;
}
