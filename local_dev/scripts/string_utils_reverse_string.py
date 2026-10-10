def reverse_string(s: str) -> str:
    """
    Reverses a given string using slicing.

    Args:
        s: The input string.

    Returns:
        The reversed string.
    """
    return s[::-1]

# Example usage (for testing purposes):
if __name__ == "__main__":
    test_string = "hello world"
    reversed_str = reverse_string(test_string)
    print(f"Original: '{test_string}'")
    print(f"Reversed: '{reversed_str}'")