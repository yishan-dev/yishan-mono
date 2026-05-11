package jobqueue

import "testing"

func TestBuildIdempotencyKey_RFC3339(t *testing.T) {
	key := buildIdempotencyKey("job-1", "2025-01-15T10:30:00Z")
	want := "job-1:2025-01-15T10:30"
	if key != want {
		t.Errorf("got %q, want %q", key, want)
	}
}

func TestBuildIdempotencyKey_SameMinute(t *testing.T) {
	k1 := buildIdempotencyKey("job-1", "2025-01-15T10:30:00Z")
	k2 := buildIdempotencyKey("job-1", "2025-01-15T10:30:45Z")
	if k1 != k2 {
		t.Errorf("same minute should produce same key: %q vs %q", k1, k2)
	}
}

func TestBuildIdempotencyKey_DifferentMinute(t *testing.T) {
	k1 := buildIdempotencyKey("job-1", "2025-01-15T10:30:00Z")
	k2 := buildIdempotencyKey("job-1", "2025-01-15T10:31:00Z")
	if k1 == k2 {
		t.Error("different minutes should produce different keys")
	}
}

func TestBuildIdempotencyKey_DifferentJob(t *testing.T) {
	k1 := buildIdempotencyKey("job-1", "2025-01-15T10:30:00Z")
	k2 := buildIdempotencyKey("job-2", "2025-01-15T10:30:00Z")
	if k1 == k2 {
		t.Error("different jobs should produce different keys")
	}
}

func TestBuildIdempotencyKey_InvalidTimestamp(t *testing.T) {
	key := buildIdempotencyKey("job-1", "not-a-timestamp")
	want := "job-1:not-a-timestamp"
	if key != want {
		t.Errorf("got %q, want %q", key, want)
	}
}
