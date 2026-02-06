from services.metrics import collect_metrics

def main():
    m = collect_metrics()
    print("=== AVAStudio Metrics Report ===")
    print()
    print("Counts by state:")
    for k, v in m.get("counts", {}).items():
        print(f"  {k}: {v}")

    c = m.get("completed", {})
    if c.get("samples", 0) > 0:
        print()
        print(
            f"Completed runtime: avg={c.get('avg')}s "
            f"p95={c.get('p95')}s "
            f"samples={c.get('samples')}"
        )
    else:
        print()
        print("Completed runtime: no completed jobs yet")

if __name__ == "__main__":
    main()
