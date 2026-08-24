param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [ValidateSet('Body','Face','Viseme','Expression')][string]$Profile='Body'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not ('SinbadAlphaRigSplitter' -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class SinbadAlphaRigSplitter {
  private sealed class Part {
    public int Id, MinX, MinY, MaxX, MaxY, Count;
  }

  public static string[] Split(string inputPath, string outputDirectory, string profile) {
    using (var image = new Bitmap(inputPath)) {
      var rect = new Rectangle(0, 0, image.Width, image.Height);
      var data = image.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = data.Stride, width = image.Width, height = image.Height;
      byte[] pixels = new byte[stride * height];
      Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
      image.UnlockBits(data);
      bool[] visited = new bool[width * height];
      int[] labels = new int[width * height];
      for (int i = 0; i < labels.Length; i++) labels[i] = -1;
      int[] queue = new int[width * height];
      var parts = new List<Part>();
      int componentId = 0;

      for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
        int start = y * width + x;
        if (visited[start] || pixels[y * stride + x * 4 + 3] == 0) continue;
        int id = componentId++;
        int head = 0, tail = 0;
        visited[start] = true; labels[start] = id; queue[tail++] = start;
        var part = new Part { Id=id, MinX=x, MaxX=x, MinY=y, MaxY=y };
        while (head < tail) {
          int index = queue[head++], px = index % width, py = index / width;
          part.Count++;
          part.MinX=Math.Min(part.MinX,px); part.MaxX=Math.Max(part.MaxX,px);
          part.MinY=Math.Min(part.MinY,py); part.MaxY=Math.Max(part.MaxY,py);
          Action<int,int> add = (nx,ny) => {
            int ni=ny*width+nx;
            if (!visited[ni] && pixels[ny*stride+nx*4+3] != 0) { visited[ni]=true; labels[ni]=id; queue[tail++]=ni; }
          };
          if(px>0)add(px-1,py); if(px+1<width)add(px+1,py);
          if(py>0)add(px,py-1); if(py+1<height)add(px,py+1);
        }
        if (part.Count >= 1000) parts.Add(part);
      }
      int expected=profile=="Face"?3:((profile=="Viseme"||profile=="Expression")?2:4);
      if (parts.Count != expected) throw new InvalidOperationException("Expected " + expected + " substantial alpha components for " + profile + ", found " + parts.Count + ".");
      parts.Sort((a,b) => a.MinY != b.MinY ? a.MinY.CompareTo(b.MinY) : a.MinX.CompareTo(b.MinX));
      Part[] ordered;
      string[] names;
      if(profile=="Face"){
        parts.Sort((a,b)=>a.MinX.CompareTo(b.MinX)); ordered=parts.ToArray();
        names=new[]{"captain-sinbad-rig-face-blink-v1.png","captain-sinbad-rig-face-open-v1.png","captain-sinbad-rig-face-round-v1.png"};
      }else if(profile=="Viseme"){
        parts.Sort((a,b)=>a.MinX.CompareTo(b.MinX)); ordered=parts.ToArray();
        names=new[]{"captain-sinbad-rig-face-closed-v1.png","captain-sinbad-rig-face-wide-v1.png"};
      }else if(profile=="Expression"){
        parts.Sort((a,b)=>a.MinX.CompareTo(b.MinX)); ordered=parts.ToArray();
        names=new[]{"captain-sinbad-rig-expression-concerned-v1.png","captain-sinbad-rig-expression-delighted-v1.png"};
      }else{
        Part headPart=parts[0];
        var lower=parts.GetRange(1,3); lower.Sort((a,b)=>a.MinX.CompareTo(b.MinX));
        ordered=new[]{headPart,lower[0],lower[1],lower[2]};
        // Screen-left is Sinbad's anatomical right arm; screen-right is his left.
        names=new[]{"captain-sinbad-rig-head-v1.png","captain-sinbad-rig-right-arm-v1.png","captain-sinbad-rig-torso-v1.png","captain-sinbad-rig-left-arm-v1.png"};
      }
      var output=new string[ordered.Length];
      for(int i=0;i<ordered.Length;i++){
        Part p=ordered[i]; const int pad=12;
        int left=Math.Max(0,p.MinX-pad), top=Math.Max(0,p.MinY-pad);
        int right=Math.Min(width-1,p.MaxX+pad), bottom=Math.Min(height-1,p.MaxY+pad);
        var cropRect=new Rectangle(left,top,right-left+1,bottom-top+1);
        using(var crop=image.Clone(cropRect,PixelFormat.Format32bppArgb)){
          var cropData=crop.LockBits(new Rectangle(0,0,crop.Width,crop.Height),ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
          byte[] cropPixels=new byte[cropData.Stride*crop.Height];
          Marshal.Copy(cropData.Scan0,cropPixels,0,cropPixels.Length);
          for(int cy=0;cy<crop.Height;cy++)for(int cx=0;cx<crop.Width;cx++){
            if(labels[(top+cy)*width+(left+cx)]==p.Id)continue;
            int offset=cy*cropData.Stride+cx*4;
            cropPixels[offset]=cropPixels[offset+1]=cropPixels[offset+2]=cropPixels[offset+3]=0;
          }
          Marshal.Copy(cropPixels,0,cropData.Scan0,cropPixels.Length);
          crop.UnlockBits(cropData);
          output[i]=Path.Combine(outputDirectory,names[i]);
          if(File.Exists(output[i]))File.Delete(output[i]);
          crop.Save(output[i],ImageFormat.Png);
        }
      }
      return output;
    }
  }
}
'@
}

$inputFull = [System.IO.Path]::GetFullPath($InputPath)
$outputFull = [System.IO.Path]::GetFullPath($OutputDirectory)
if (-not [System.IO.Directory]::Exists($outputFull)) { throw "Output directory does not exist: $outputFull" }
[SinbadAlphaRigSplitter]::Split($inputFull, $outputFull, $Profile) | ForEach-Object { Write-Output $_ }
