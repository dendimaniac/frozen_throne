export function clampPosition(
  origin: Vector,
  target: Vector,
  options?: { maxRange?: number; minRange?: number }
) {
  const direction = target.__sub(origin).Normalized();
  const distance = target.__sub(origin).Length2D();
  print(
    `Distance: ${distance}, direction: ${direction}. Max range: ${options?.maxRange}, min range: ${options?.minRange}`
  );
  let result = target;

  if (options?.maxRange && distance > options?.maxRange) {
    result = direction.__mul(options?.maxRange).__add(origin);
  }

  if (options?.minRange && distance < options.minRange) {
    result = direction.__mul(options?.minRange).__add(origin);
  }

  return result;
}
