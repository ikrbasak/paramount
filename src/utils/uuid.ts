export class UuidUtil {
  static serialize(id: string) {
    return id.replaceAll('-', '');
  }

  static deserialize(id: string) {
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }

  static generate() {
    return Bun.randomUUIDv7();
  }
}
