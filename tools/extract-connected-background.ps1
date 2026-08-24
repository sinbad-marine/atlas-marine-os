param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('SinbadConnectedBackgroundExtractor' -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SinbadConnectedBackgroundExtractor {
  private static bool IsBackground(byte b, byte g, byte r) {
    int min = Math.Min(r, Math.Min(g, b));
    int max = Math.Max(r, Math.Max(g, b));
    return min >= 220 && max - min <= 12;
  }

  public static int Extract(string inputPath, string outputPath) {
    using (var source = new Bitmap(inputPath))
    using (var image = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb)) {
      using (var graphics = Graphics.FromImage(image)) graphics.DrawImageUnscaled(source, 0, 0);
      var rect = new Rectangle(0, 0, image.Width, image.Height);
      var data = image.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = data.Stride;
      byte[] pixels = new byte[stride * image.Height];
      Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

      int width = image.Width, height = image.Height;
      bool[] visited = new bool[width * height];
      int[] queue = new int[width * height];
      int head = 0, tail = 0;
      Action<int,int> seed = (x,y) => {
        int index = y * width + x;
        int offset = y * stride + x * 4;
        if (!visited[index] && IsBackground(pixels[offset], pixels[offset+1], pixels[offset+2])) {
          visited[index] = true;
          queue[tail++] = index;
        }
      };
      for (int x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
      for (int y = 1; y < height - 1; y++) { seed(0, y); seed(width - 1, y); }

      while (head < tail) {
        int index = queue[head++];
        int x = index % width, y = index / width;
        int offset = y * stride + x * 4;
        pixels[offset] = pixels[offset+1] = pixels[offset+2] = 0;
        pixels[offset+3] = 0;
        if (x > 0) seed(x - 1, y);
        if (x + 1 < width) seed(x + 1, y);
        if (y > 0) seed(x, y - 1);
        if (y + 1 < height) seed(x, y + 1);
      }

      Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
      image.UnlockBits(data);
      image.Save(outputPath, ImageFormat.Png);
      return tail;
    }
  }
}
'@
}

$inputFull = [System.IO.Path]::GetFullPath($InputPath)
$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($outputFull)
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
  throw "Output directory does not exist: $outputDirectory"
}
if ([System.StringComparer]::OrdinalIgnoreCase.Equals($inputFull, $outputFull)) {
  throw 'Input and output paths must differ.'
}

$removed = [SinbadConnectedBackgroundExtractor]::Extract($inputFull, $outputFull)
Write-Output "Removed connected background pixels: $removed"
